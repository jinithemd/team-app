import { calendarIcs } from "@/lib/data";

// Subscribed calendars (iPhone, Google, Outlook) fetch this. The token is the only key.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await calendarIcs(token);
  if (!body) return new Response("This calendar link has been reset or is no longer valid.", { status: 404 });
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "Content-Disposition": 'inline; filename="my-teams.ics"' },
  });
}
