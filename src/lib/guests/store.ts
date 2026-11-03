import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";

/*
 * Guest players storage. Sample build: memory. Live: Supabase through the server key; the
 * service (service.ts) checks who may do what first.
 */

export interface Guest {
  id: string;
  teamId: string;
  userId: string | null;
  name: string;
  email: string | null;
  /** On the team's guest list (gets pickup games, matches, tournaments and events). false = a one-off for one game. */
  onList: boolean;
  addedBy: string | null;
  createdAt: string;
}

export type GuestResponse = "going" | "maybe" | "not_going";
export interface Invite {
  id: string;
  eventId: string;
  teamId: string;
  guestId: string;
  response: GuestResponse | null;
  respondedAt: string | null;
  createdAt: string;
}

/** The bits of a team event a guest needs (guests can't read the team's schedule). */
export interface GuestEvent {
  id: string;
  teamId: string;
  seriesId: string | null;
  sessionId: string | null;
  type: "match" | "training" | "tournament" | "social" | "other";
  title: string | null;
  opponent: string | null;
  homeAway: "home" | "away" | "neutral" | null;
  startAt: string;
  endAt: string;
  tz: string;
  locationText: string | null;
  notes: string | null;
  status: "active" | "postponed" | "cancelled";
  statusReason: string | null;
}

type Row = Record<string, unknown>;
type Mem = { guests: Guest[]; invites: Invite[] };
const g = globalThis as unknown as { __clbxGuests?: Mem };
const mem: Mem = (g.__clbxGuests ??= { guests: [], invites: [] });

async function admin(): Promise<SupabaseClient> {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as SupabaseClient;
}
const s = (v: unknown) => (v == null ? null : String(v));
function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`guests: ${what}: ${error.message}`);
}

const toGuest = (r: Row): Guest => ({
  id: String(r.id), teamId: String(r.team_id), userId: s(r.user_id), name: String(r.name), email: s(r.email), onList: !!r.on_list, addedBy: s(r.added_by), createdAt: String(r.created_at),
});
const toInvite = (r: Row): Invite => ({
  id: String(r.id), eventId: String(r.event_id), teamId: String(r.team_id), guestId: String(r.guest_id), response: (r.response as GuestResponse | null) ?? null, respondedAt: s(r.responded_at), createdAt: String(r.created_at),
});

// ---- guests ----------------------------------------------------------------

export async function guestsFor(teamId: string): Promise<Guest[]> {
  if (!LIVE) return mem.guests.filter((x) => x.teamId === teamId).map((x) => ({ ...x }));
  const { data, error } = await (await admin()).from("team_guests").select("*").eq("team_id", teamId);
  check(error, "list");
  return ((data ?? []) as Row[]).map(toGuest);
}

export async function guestById(id: string): Promise<Guest | null> {
  if (!LIVE) return mem.guests.find((x) => x.id === id) ?? null;
  const { data } = await (await admin()).from("team_guests").select("*").eq("id", id).maybeSingle();
  return data ? toGuest(data as Row) : null;
}

/** Every team where this person is a guest. */
export async function guestRowsForUser(userId: string): Promise<Guest[]> {
  if (!LIVE) return mem.guests.filter((x) => x.userId === userId).map((x) => ({ ...x }));
  const { data } = await (await admin()).from("team_guests").select("*").eq("user_id", userId);
  return ((data ?? []) as Row[]).map(toGuest);
}

export async function insertGuest(x: Omit<Guest, "id" | "createdAt">): Promise<Guest> {
  const row: Guest = { ...x, id: randomUUID(), createdAt: new Date().toISOString() };
  if (!LIVE) {
    mem.guests.push(row);
    return { ...row };
  }
  const { data, error } = await (await admin())
    .from("team_guests")
    .insert({ id: row.id, team_id: x.teamId, user_id: x.userId, name: x.name, email: x.email, on_list: x.onList, added_by: x.addedBy })
    .select("*")
    .single();
  check(error, "add");
  return toGuest(data as Row);
}

export async function updateGuest(id: string, patch: Partial<Pick<Guest, "onList" | "name" | "email" | "userId">>) {
  if (!LIVE) {
    Object.assign(mem.guests.find((x) => x.id === id) ?? {}, patch);
    return;
  }
  const p: Row = {};
  if (patch.onList !== undefined) p.on_list = patch.onList;
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.email !== undefined) p.email = patch.email;
  if (patch.userId !== undefined) p.user_id = patch.userId;
  check((await (await admin()).from("team_guests").update(p).eq("id", id)).error, "update");
}

// ---- invites (who's asked to which game) ------------------------------------

export async function invitesForEvents(eventIds: string[]): Promise<Invite[]> {
  if (!eventIds.length) return [];
  if (!LIVE) return mem.invites.filter((x) => eventIds.includes(x.eventId)).map((x) => ({ ...x }));
  const { data, error } = await (await admin()).from("event_guests").select("*").in("event_id", eventIds);
  check(error, "invites");
  return ((data ?? []) as Row[]).map(toInvite);
}

export async function invitesForGuests(guestIds: string[]): Promise<Invite[]> {
  if (!guestIds.length) return [];
  if (!LIVE) return mem.invites.filter((x) => guestIds.includes(x.guestId)).map((x) => ({ ...x }));
  const { data } = await (await admin()).from("event_guests").select("*").in("guest_id", guestIds);
  return ((data ?? []) as Row[]).map(toInvite);
}

/** Invites guests to games; returns only the ones that are new. */
export async function addInvites(rows: { eventId: string; teamId: string; guestId: string }[]): Promise<Invite[]> {
  if (!rows.length) return [];
  if (!LIVE) {
    const out: Invite[] = [];
    for (const r of rows) {
      if (mem.invites.some((x) => x.eventId === r.eventId && x.guestId === r.guestId)) continue;
      const inv: Invite = { ...r, id: randomUUID(), response: null, respondedAt: null, createdAt: new Date().toISOString() };
      mem.invites.push(inv);
      out.push({ ...inv });
    }
    return out;
  }
  const { data, error } = await (await admin())
    .from("event_guests")
    .upsert(rows.map((r) => ({ event_id: r.eventId, team_id: r.teamId, guest_id: r.guestId })), { onConflict: "event_id,guest_id", ignoreDuplicates: true })
    .select("*");
  check(error, "invite");
  return ((data ?? []) as Row[]).map(toInvite);
}

export async function removeInvite(eventId: string, guestId: string) {
  if (!LIVE) {
    mem.invites = mem.invites.filter((x) => !(x.eventId === eventId && x.guestId === guestId));
    return;
  }
  check((await (await admin()).from("event_guests").delete().eq("event_id", eventId).eq("guest_id", guestId)).error, "uninvite");
}

export async function setResponse(eventId: string, guestId: string, response: GuestResponse): Promise<boolean> {
  const at = new Date().toISOString();
  if (!LIVE) {
    const i = mem.invites.find((x) => x.eventId === eventId && x.guestId === guestId);
    if (!i) return false;
    Object.assign(i, { response, respondedAt: at });
    return true;
  }
  const { data, error } = await (await admin()).from("event_guests").update({ response, responded_at: at }).eq("event_id", eventId).eq("guest_id", guestId).select("id");
  check(error, "answer");
  return !!data?.length;
}

// ---- events (read with the server key: guests aren't on the team) -------------

const EVENT_COLS = "id, team_id, series_id, session_id, type, title, opponent, home_away, start_at, end_at, tz, location_text, notes, status, status_reason";
const toEvent = (r: Row): GuestEvent => ({
  id: String(r.id), teamId: String(r.team_id), seriesId: s(r.series_id), sessionId: s(r.session_id), type: r.type as GuestEvent["type"], title: s(r.title), opponent: s(r.opponent),
  homeAway: (r.home_away as GuestEvent["homeAway"]) ?? null, startAt: String(r.start_at), endAt: String(r.end_at), tz: String(r.tz), locationText: s(r.location_text), notes: s(r.notes),
  status: r.status as GuestEvent["status"], statusReason: s(r.status_reason),
});

export async function eventsById(ids: string[]): Promise<GuestEvent[]> {
  if (!ids.length) return [];
  if (!LIVE) {
    const { db } = await import("../data/store");
    return db.events.filter((e) => ids.includes(e.id)).map((e) => ({ ...e, seriesId: e.seriesId, sessionId: e.sessionId ?? null }) as GuestEvent);
  }
  const { data } = await (await admin()).from("events").select(EVENT_COLS).in("id", ids);
  return ((data ?? []) as Row[]).map(toEvent);
}

/** This event and the later ones in its weekly series. */
export async function seriesFrom(e: GuestEvent): Promise<GuestEvent[]> {
  if (!e.seriesId) return [e];
  if (!LIVE) {
    const { db } = await import("../data/store");
    return db.events.filter((x) => x.seriesId === e.seriesId && x.startAt >= e.startAt).map((x) => ({ ...x, sessionId: x.sessionId ?? null }) as GuestEvent);
  }
  const { data } = await (await admin()).from("events").select(EVENT_COLS).eq("series_id", e.seriesId).gte("start_at", e.startAt);
  return ((data ?? []) as Row[]).map(toEvent);
}

// ---- people ------------------------------------------------------------------

export interface Profile {
  id: string;
  name: string;
  email: string;
}

export async function profiles(ids: string[]): Promise<Map<string, Profile>> {
  const { people } = await import("../sessions/store");
  return people(ids);
}

export async function profileByEmail(email: string): Promise<Profile | null> {
  const e = email.trim().toLowerCase();
  if (!LIVE) {
    const { db } = await import("../data/store");
    const p = db.profiles.find((x) => x.email.toLowerCase() === e);
    return p ? { id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), email: p.email } : null;
  }
  const { data } = await (await admin()).from("profiles").select("id, first_name, last_name, email").ilike("email", e).limit(1);
  const r = (data ?? [])[0] as Row | undefined;
  return r ? { id: String(r.id), name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), email: String(r.email ?? "") } : null;
}

/**
 * People this team already knows, to search by name: players on the club's other teams,
 * the team's followers, people who've booked its drop-in games, and other teams' guests in
 * the same club. (Searching every Clbx account by name isn't allowed; an exact email is.)
 */
export async function knownPeople(teamId: string): Promise<string[]> {
  const ids = new Set<string>();
  const { followerIds } = await import("../sessions/store");
  for (const id of await followerIds(teamId)) ids.add(id);
  if (!LIVE) {
    const { db } = await import("../data/store");
    const team = db.teams.find((t) => t.id === teamId);
    const clubTeams = team?.clubId ? db.teams.filter((t) => t.clubId === team.clubId).map((t) => t.id) : [teamId];
    for (const r of db.roster) if (clubTeams.includes(r.teamId) && r.userId && r.status !== "removed") ids.add(r.userId);
    for (const x of mem.guests) if (clubTeams.includes(x.teamId) && x.userId) ids.add(x.userId);
    const { sessionsFor, bookingsFor } = await import("../sessions/store");
    const ses = await sessionsFor(teamId, "1970-01-01T00:00:00Z");
    for (const b of await bookingsFor(ses.map((x) => x.id))) ids.add(b.userId);
    return [...ids];
  }
  const sb = await admin();
  const { data: t } = await sb.from("teams").select("club_id").eq("id", teamId).maybeSingle();
  const clubId = (t as Row | null)?.club_id as string | null;
  const clubTeams = clubId ? (((await sb.from("teams").select("id").eq("club_id", clubId)).data ?? []) as Row[]).map((r) => String(r.id)) : [teamId];
  const [ros, gst, ses] = await Promise.all([
    sb.from("roster_members").select("user_id").in("team_id", clubTeams).neq("status", "removed").not("user_id", "is", null),
    sb.from("team_guests").select("user_id").in("team_id", clubTeams).not("user_id", "is", null),
    sb.from("game_sessions").select("id").eq("team_id", teamId),
  ]);
  for (const r of [...((ros.data ?? []) as Row[]), ...((gst.data ?? []) as Row[])]) ids.add(String(r.user_id));
  const sesIds = ((ses.data ?? []) as Row[]).map((r) => String(r.id));
  if (sesIds.length) {
    const { data } = await sb.from("session_bookings").select("user_id").in("session_id", sesIds);
    for (const r of (data ?? []) as Row[]) ids.add(String(r.user_id));
  }
  return [...ids];
}

export async function rosterUserIds(teamId: string): Promise<string[]> {
  if (!LIVE) {
    const { db } = await import("../data/store");
    return db.roster.filter((r) => r.teamId === teamId && r.userId && r.status !== "removed").map((r) => r.userId!);
  }
  const { data } = await (await admin()).from("roster_members").select("user_id").eq("team_id", teamId).neq("status", "removed").not("user_id", "is", null);
  return ((data ?? []) as Row[]).map((r) => String(r.user_id));
}
