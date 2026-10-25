import { processOutbox } from "@/lib/email/worker";

// Sends waiting email. Called by the daily schedule (vercel.json) as a backstop; most email
// goes out straight after the save that queued it. Needs the CRON_SECRET bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not allowed", { status: 401 });
  const res = await processOutbox(200);
  return Response.json(res);
}
