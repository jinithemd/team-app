import "server-only";
import { adminClient } from "../supabase/server";
import { renderOutbox } from "./render";
import { emailHtml, emailText } from "./template";

/*
 * Sends what's waiting in the outbox through Resend. Runs straight after a save that queued
 * email (see kickOutbox) and on a daily schedule as a backstop. Each row is claimed before
 * sending (attempts + 1, pushed back 10 minutes), so two runs never send the same email twice.
 * Failures retry with a growing wait; after 5 tries the row is marked failed with the reason.
 */

const MAX_TRIES = 5;
const RESEND_URL = process.env.RESEND_API_URL || "https://api.resend.com";

export async function sendEmail(m: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`${RESEND_URL}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Team App <onboarding@resend.dev>", to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function processOutbox(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const admin = adminClient();
  const now = new Date();
  const { data: due } = await admin
    .from("outbox")
    .select("id, kind, user_id, payload, created_at, attempts")
    .eq("channel", "email")
    .eq("status", "pending")
    .lte("run_after", now.toISOString())
    .order("created_at")
    .limit(limit);
  const out = { sent: 0, failed: 0, skipped: 0 };
  for (const row of due ?? []) {
    // Claim it: only one run gets the row.
    const { data: claimed } = await admin
      .from("outbox")
      .update({ attempts: row.attempts + 1, run_after: new Date(now.getTime() + 10 * 60_000).toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("attempts", row.attempts)
      .select("id");
    if (!claimed?.length) continue;
    try {
      const mail = await renderOutbox(admin, row);
      if (!mail.to) {
        await admin.from("outbox").update({ status: "skipped", last_error: "no address" }).eq("id", row.id);
        out.skipped++;
        continue;
      }
      await sendEmail({ to: mail.to, subject: mail.subject, html: emailHtml(mail), text: emailText(mail) });
      await admin.from("outbox").update({ status: "sent", last_error: null }).eq("id", row.id);
      out.sent++;
    } catch (e) {
      const tries = row.attempts + 1;
      const wait = Math.min(60, 2 ** tries) * 60_000; // 2, 4, 8, 16, 32 minutes
      await admin
        .from("outbox")
        .update(tries >= MAX_TRIES ? { status: "failed", last_error: String(e).slice(0, 500) } : { run_after: new Date(Date.now() + wait).toISOString(), last_error: String(e).slice(0, 500) })
        .eq("id", row.id);
      out.failed++;
    }
  }
  return out;
}

/** After a save that queued email: send it once the response has gone, without making anyone wait. */
export async function kickOutbox() {
  if (!process.env.RESEND_API_KEY) return;
  const { after } = await import("next/server");
  try {
    after(() => processOutbox().catch((e) => console.error("[outbox]", e)));
  } catch {
    // Outside a request (a script): send now.
    await processOutbox();
  }
}
