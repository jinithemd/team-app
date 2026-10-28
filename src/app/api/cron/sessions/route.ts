import { runDue } from "@/lib/sessions/service";
import { processOutbox } from "@/lib/email/worker";

/*
 * Every 15 minutes (Supabase pg_cron calls this): posts weekly game sessions that are due,
 * announces them, and sends waiting email and phone notifications.
 * Needs the x-cron-key header (SESSIONS_CRON_KEY) or the Vercel cron bearer (CRON_SECRET).
 */
export const dynamic = "force-dynamic";

async function run(req: Request) {
  const key = process.env.SESSIONS_CRON_KEY;
  const bearer = process.env.CRON_SECRET;
  const ok = (key && req.headers.get("x-cron-key") === key) || (bearer && req.headers.get("authorization") === `Bearer ${bearer}`);
  if (!ok) return new Response("Not allowed", { status: 401 });
  await runDue();
  const mail = process.env.RESEND_API_KEY ? await processOutbox(100) : null;
  return Response.json({ ok: true, mail });
}

export const GET = run;
export const POST = run;
