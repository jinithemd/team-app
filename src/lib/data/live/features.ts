import "server-only";
import { randomBytes } from "node:crypto";
import type { ActionResult, AttendanceStatus, ID, Person, RsvpResponse, TeamEvent } from "../types";
import { adminClient, userClient } from "../../supabase/server";
import { sign, verify } from "../../tokens";
import { APP_URL } from "../store";
import { buildIcs } from "../feeds";
import { TABLES } from "./tables";
import type { Aux } from "./tables";
import { emptyStore } from "./load";

/*
 * Live versions of things that happen without a signed-in person, or that a player may do
 * to a row they can't write themselves:
 * - the calendar feed (phone calendars fetch it with only the link's token),
 * - one-tap answers from emails (the token names the player),
 * - geo check-in (the database checks the distance and writes the attendance).
 */

const FEED_TTL = 60 * 60 * 24 * 365 * 5;
const eventSpec = TABLES.find((t) => t.key === "events")!;
const toEvent = (row: Record<string, unknown>) => eventSpec.toApp(row, { store: emptyStore(), pollOptions: new Map() } as Aux) as TeamEvent;

async function me() {
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

// Each reset adds a row to calendar_feeds; the feed link carries how many there were.
async function feedVersion(uid: ID) {
  const { count } = await adminClient().from("calendar_feeds").select("id", { count: "exact", head: true }).eq("user_id", uid);
  return count ?? 0;
}
function feedLinks(uid: ID, v: number) {
  const https = `${APP_URL}/cal/${sign({ k: "cal", u: uid, v }, FEED_TTL)}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

export async function myCalendarFeed() {
  const uid = await me();
  return feedLinks(uid, await feedVersion(uid));
}

export async function resetCalendarFeed() {
  const uid = await me();
  const admin = adminClient();
  await admin.from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("user_id", uid).is("revoked_at", null);
  await admin.from("calendar_feeds").insert({ user_id: uid, token_hash: randomBytes(16).toString("hex") });
  return feedLinks(uid, await feedVersion(uid));
}

export async function calendarIcs(token: string): Promise<string | null> {
  const t = verify<{ k: string; u: string; v: number }>(token.replace(/\.ics$/, ""));
  if (!t || t.k !== "cal" || t.v !== (await feedVersion(t.u))) return null;
  const admin = adminClient();
  const { data: rows } = await admin.from("roster_members").select("team_id").eq("user_id", t.u).in("status", ["active", "inactive"]);
  const teamIds = [...new Set((rows ?? []).map((r) => r.team_id))];
  if (!teamIds.length) return buildIcs([]);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: teams }, { data: events }] = await Promise.all([
    admin.from("teams").select("id, name").in("id", teamIds),
    admin.from("events").select("*").in("team_id", teamIds).gt("end_at", since).order("start_at"),
  ]);
  const venueIds = [...new Set((events ?? []).map((e) => e.venue_id).filter((x): x is string => !!x))];
  const { data: venues } = venueIds.length ? await admin.from("venues").select("id, name, address, lat, lng").in("id", venueIds) : { data: [] };
  return buildIcs(
    (events ?? []).map((row) => {
      const e = toEvent(row);
      return { e, team: teams!.find((x) => x.id === e.teamId)!, venue: venues?.find((v) => v.id === e.venueId) ?? undefined };
    }),
  );
}

/** One-tap answer from an email: no sign-in. The signed token names the player and the answer. */
export async function rsvpFromLink(token: string): Promise<ActionResult<{ event: TeamEvent; person: Person; response: RsvpResponse; teamName: string }>> {
  const d = verify<{ k: string; e: string; u: string; r: RsvpResponse }>(token);
  if (!d || d.k !== "rsvp" || !["going", "maybe", "not_going"].includes(d.r)) return { ok: false, error: "This link has expired. Open the app to answer instead." };
  const admin = adminClient();
  const { data: row } = await admin.from("events").select("*").eq("id", d.e).maybeSingle();
  if (!row) return { ok: false, error: "That event no longer exists." };
  const event = toEvent(row);
  if (event.status === "cancelled") return { ok: false, error: "This event was cancelled." };
  const [{ data: rm }, { data: p }, { data: team }] = await Promise.all([
    admin.from("roster_members").select("id").eq("team_id", event.teamId).eq("user_id", d.u).eq("status", "active").eq("is_player", true).maybeSingle(),
    admin.from("profiles").select("id, first_name, last_name").eq("id", d.u).maybeSingle(),
    admin.from("teams").select("name").eq("id", event.teamId).single(),
  ]);
  if (!rm || !p) return { ok: false, error: "Only players on the team can answer." };
  const { error } = await admin
    .from("rsvps")
    .upsert({ event_id: d.e, user_id: d.u, response: d.r, responded_by: d.u }, { onConflict: "event_id,user_id" });
  if (error) return { ok: false, error: "We couldn't save that. Open the app to answer instead." };
  return { ok: true, data: { event, person: { id: p.id, firstName: p.first_name, lastName: p.last_name }, response: d.r, teamName: team?.name ?? "" } };
}

/** "I'm here": the database checks the distance to the venue and writes the attendance and points. */
export async function checkIn(eventId: ID, lat: number, lng: number, accuracy: number): Promise<ActionResult<{ status: AttendanceStatus; minutesLate: number | null; distanceM: number }>> {
  const sb = await userClient();
  const { data, error } = await sb.rpc("check_in", { p_event: eventId, p_lat: lat, p_lng: lng, p_accuracy_m: accuracy });
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") };
  const r = data?.[0];
  if (!r) return { ok: false, error: "Couldn't check you in. Try again." };
  return { ok: true, data: { status: r.status as AttendanceStatus, minutesLate: r.minutes_late, distanceM: r.distance_m } };
}
