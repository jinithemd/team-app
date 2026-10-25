import "server-only";
import type { ActionResult, Profile } from "../types";

// Live build: people sign in with Supabase Auth (src/lib/auth.ts), not demo accounts.

export async function listDemoAccounts(): Promise<{ id: string; name: string; email: string; blurb: string }[]> {
  return [];
}

export async function signInAs(): Promise<void> {
  throw new Error("Demo accounts are only in the sample-data build");
}

export async function signUp(): Promise<ActionResult<Profile>> {
  return { ok: false, error: "Sign up with the email link instead." };
}

/** The sample inbox page, for local testing only (DEV_OUTBOX=1). Real emails go out through the outbox worker. */
export async function listOutbox(): Promise<import("../types").OutboxEmail[]> {
  if (process.env.DEV_OUTBOX !== "1") return [];
  const { adminClient } = await import("../../supabase/server");
  const admin = adminClient();
  const { data } = await admin.from("outbox").select("id, kind, user_id, payload, created_at").eq("channel", "email").order("created_at", { ascending: false }).limit(50);
  const { renderOutbox } = await import("../../email/render");
  return Promise.all((data ?? []).map((r) => renderOutbox(admin, r)));
}
