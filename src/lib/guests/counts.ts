import "server-only";
import { LIVE } from "../mode";

/** How many are going to a game (team players and guests), for a guest who can't see the team's list. */
export async function getAvailabilityCounts(eventId: string, _teamId: string): Promise<number> {
  const st = await import("./store");
  const guests = (await st.invitesForEvents([eventId])).filter((i) => i.response === "going").length;
  if (!LIVE) {
    const { db } = await import("../data/store");
    return guests + db.rsvps.filter((r) => r.eventId === eventId && r.response === "going").length;
  }
  const { adminClient } = await import("../supabase/server");
  const { count } = await adminClient().from("rsvps").select("user_id", { count: "exact", head: true }).eq("event_id", eventId).eq("response", "going");
  return guests + (count ?? 0);
}
