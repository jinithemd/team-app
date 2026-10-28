import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";

/*
 * Game sessions storage. Sample build: memory. Live: Supabase through the server key; the
 * service (service.ts) checks who may do what first.
 */

export interface Series {
  id: string;
  teamId: string;
  title: string;
  weekday: number; // 0 = Sunday
  startTime: string; // "10:00"
  endTime: string;
  tz: string;
  venueName: string | null;
  venueAddress: string | null;
  priceCents: number;
  capacity: number;
  memberSpots: number;
  releaseHours: number | null;
  postDaysBefore: number;
  postTime: string;
  notes: string | null;
  skipDates: string[];
  active: boolean;
  createdBy: string | null;
}

export interface Session {
  id: string;
  teamId: string;
  seriesId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  tz: string;
  venueName: string | null;
  venueAddress: string | null;
  priceCents: number;
  capacity: number;
  memberSpots: number;
  releaseAt: string | null;
  notes: string | null;
  status: "scheduled" | "cancelled";
  postAt: string;
  announcedAt: string | null;
  createdBy: string | null;
}

export type BookingStatus = "booked" | "held" | "waitlist" | "cancelled";
export interface Booking {
  id: string;
  sessionId: string;
  userId: string;
  status: BookingStatus;
  member: boolean;
  paid: "card" | "cash" | null;
  holdUntil: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------

interface Mem {
  series: Series[];
  sessions: Session[];
  bookings: Booking[];
}
const g = globalThis as unknown as { __clbxSessions?: Mem };
const mem: Mem = (g.__clbxSessions ??= { series: [], sessions: [], bookings: [] } as Mem);

type Row = Record<string, unknown>;
async function admin(): Promise<SupabaseClient> {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as SupabaseClient;
}
const s = (v: unknown) => (v == null ? null : String(v));
const hm = (v: unknown) => String(v ?? "").slice(0, 5);
function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[sessions] ${what}: ${error.message}`);
    throw new Error("Couldn't save that. Try again.");
  }
}

const toSeries = (r: Row): Series => ({
  id: s(r.id)!, teamId: s(r.team_id)!, title: s(r.title)!, weekday: Number(r.weekday), startTime: hm(r.start_time), endTime: hm(r.end_time), tz: s(r.tz) ?? "America/Toronto",
  venueName: s(r.venue_name), venueAddress: s(r.venue_address), priceCents: Number(r.price_cents ?? 0), capacity: Number(r.capacity), memberSpots: Number(r.member_spots ?? 0),
  releaseHours: r.release_hours == null ? null : Number(r.release_hours), postDaysBefore: Number(r.post_days_before ?? 6), postTime: hm(r.post_time), notes: s(r.notes),
  skipDates: ((r.skip_dates as string[] | null) ?? []).map(String), active: !!r.active, createdBy: s(r.created_by),
});
const fromSeries = (x: Partial<Series>): Row => {
  const m: Record<string, string> = {
    teamId: "team_id", title: "title", weekday: "weekday", startTime: "start_time", endTime: "end_time", tz: "tz", venueName: "venue_name", venueAddress: "venue_address",
    priceCents: "price_cents", capacity: "capacity", memberSpots: "member_spots", releaseHours: "release_hours", postDaysBefore: "post_days_before", postTime: "post_time",
    notes: "notes", skipDates: "skip_dates", active: "active", createdBy: "created_by",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(x)) if (m[k]) out[m[k]] = v;
  return out;
};
const toSession = (r: Row): Session => ({
  id: s(r.id)!, teamId: s(r.team_id)!, seriesId: s(r.series_id), title: s(r.title)!, startsAt: new Date(String(r.starts_at)).toISOString(), endsAt: new Date(String(r.ends_at)).toISOString(),
  tz: s(r.tz) ?? "America/Toronto", venueName: s(r.venue_name), venueAddress: s(r.venue_address), priceCents: Number(r.price_cents ?? 0), capacity: Number(r.capacity),
  memberSpots: Number(r.member_spots ?? 0), releaseAt: r.release_at ? new Date(String(r.release_at)).toISOString() : null, notes: s(r.notes), status: r.status as Session["status"],
  postAt: new Date(String(r.post_at)).toISOString(), announcedAt: s(r.announced_at), createdBy: s(r.created_by),
});
const fromSession = (x: Partial<Session>): Row => {
  const m: Record<string, string> = {
    id: "id", teamId: "team_id", seriesId: "series_id", title: "title", startsAt: "starts_at", endsAt: "ends_at", tz: "tz", venueName: "venue_name", venueAddress: "venue_address",
    priceCents: "price_cents", capacity: "capacity", memberSpots: "member_spots", releaseAt: "release_at", notes: "notes", status: "status", postAt: "post_at",
    announcedAt: "announced_at", createdBy: "created_by",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(x)) if (m[k]) out[m[k]] = v;
  return out;
};
const toBooking = (r: Row): Booking => ({
  id: s(r.id)!, sessionId: s(r.session_id)!, userId: s(r.user_id)!, status: r.status as BookingStatus, member: !!r.member, paid: (s(r.paid) as Booking["paid"]) ?? null,
  holdUntil: r.hold_until ? new Date(String(r.hold_until)).toISOString() : null, createdAt: new Date(String(r.created_at)).toISOString(),
});
const fromBooking = (x: Partial<Booking>): Row => {
  const m: Record<string, string> = { id: "id", sessionId: "session_id", userId: "user_id", status: "status", member: "member", paid: "paid", holdUntil: "hold_until" };
  const out: Row = {};
  for (const [k, v] of Object.entries(x)) if (m[k]) out[m[k]] = v;
  return out;
};

// ---- series ---------------------------------------------------------------

export async function seriesFor(teamId: string): Promise<Series[]> {
  if (!LIVE) return mem.series.filter((x) => x.teamId === teamId);
  const { data } = await (await admin()).from("session_series").select("*").eq("team_id", teamId).order("weekday");
  return (data ?? []).map(toSeries);
}
export async function activeSeries(): Promise<Series[]> {
  if (!LIVE) return mem.series.filter((x) => x.active);
  const { data } = await (await admin()).from("session_series").select("*").eq("active", true);
  return (data ?? []).map(toSeries);
}
export async function seriesById(id: string): Promise<Series | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!LIVE) return mem.series.find((x) => x.id === id) ?? null;
  const { data } = await (await admin()).from("session_series").select("*").eq("id", id).maybeSingle();
  return data ? toSeries(data) : null;
}
export async function insertSeries(x: Omit<Series, "id">): Promise<Series> {
  const row = { ...x, id: randomUUID() };
  if (!LIVE) {
    mem.series.push(row);
    return row;
  }
  const { data, error } = await (await admin()).from("session_series").insert({ id: row.id, ...fromSeries(x) }).select("*").single();
  check(error, "insert series");
  return toSeries(data!);
}
export async function updateSeries(id: string, patch: Partial<Series>) {
  if (!LIVE) {
    Object.assign(mem.series.find((x) => x.id === id) ?? {}, patch);
    return;
  }
  const { error } = await (await admin()).from("session_series").update({ ...fromSeries(patch), updated_at: new Date().toISOString() }).eq("id", id);
  check(error, "update series");
}

// ---- sessions -------------------------------------------------------------

export async function sessionsFor(teamId: string, fromIso: string): Promise<Session[]> {
  if (!LIVE) return mem.sessions.filter((x) => x.teamId === teamId && x.endsAt >= fromIso).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const { data } = await (await admin()).from("game_sessions").select("*").eq("team_id", teamId).gte("ends_at", fromIso).order("starts_at").limit(100);
  return (data ?? []).map(toSession);
}
export async function sessionsForTeams(teamIds: string[], fromIso: string, nowIso: string): Promise<Session[]> {
  if (!teamIds.length) return [];
  if (!LIVE) return mem.sessions.filter((x) => teamIds.includes(x.teamId) && x.endsAt >= fromIso && x.postAt <= nowIso && x.status === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const { data } = await (await admin()).from("game_sessions").select("*").in("team_id", teamIds).eq("status", "scheduled").gte("ends_at", fromIso).lte("post_at", nowIso).order("starts_at").limit(30);
  return (data ?? []).map(toSession);
}
export async function sessionById(id: string): Promise<Session | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!LIVE) return mem.sessions.find((x) => x.id === id) ?? null;
  const { data } = await (await admin()).from("game_sessions").select("*").eq("id", id).maybeSingle();
  return data ? toSession(data) : null;
}
export async function unannounced(nowIso: string): Promise<Session[]> {
  if (!LIVE) return mem.sessions.filter((x) => !x.announcedAt && x.postAt <= nowIso && x.status === "scheduled" && x.startsAt > nowIso);
  const { data } = await (await admin()).from("game_sessions").select("*").is("announced_at", null).eq("status", "scheduled").lte("post_at", nowIso).gt("starts_at", nowIso).limit(50);
  return (data ?? []).map(toSession);
}
/** Inserts unless the series already has a session at that time. Returns null if it did. */
export async function insertSession(x: Omit<Session, "id">): Promise<Session | null> {
  const row = { ...x, id: randomUUID() };
  if (!LIVE) {
    if (x.seriesId && mem.sessions.some((y) => y.seriesId === x.seriesId && y.startsAt === x.startsAt)) return null;
    mem.sessions.push(row);
    return row;
  }
  const { data, error } = await (await admin()).from("game_sessions").insert(fromSession(row)).select("*");
  if (error && /duplicate key/i.test(error.message)) return null;
  check(error, "insert session");
  return data?.[0] ? toSession(data[0]) : null;
}
export async function seriesHasSession(seriesId: string, startsAt: string) {
  if (!LIVE) return mem.sessions.some((y) => y.seriesId === seriesId && y.startsAt === startsAt);
  const { data } = await (await admin()).from("game_sessions").select("id").eq("series_id", seriesId).eq("starts_at", startsAt).maybeSingle();
  return !!data;
}
/** Update; with onlyIfUnannounced, only claims a session nobody else announced yet. */
export async function updateSession(id: string, patch: Partial<Session>, onlyIfUnannounced = false): Promise<boolean> {
  if (!LIVE) {
    const x = mem.sessions.find((y) => y.id === id);
    if (!x || (onlyIfUnannounced && x.announcedAt)) return false;
    Object.assign(x, patch);
    return true;
  }
  let q = (await admin()).from("game_sessions").update({ ...fromSession(patch), updated_at: new Date().toISOString() }).eq("id", id);
  if (onlyIfUnannounced) q = q.is("announced_at", null);
  const { data, error } = await q.select("id");
  check(error, "update session");
  return !!data?.length;
}

// ---- bookings -------------------------------------------------------------

export async function bookingsFor(sessionIds: string[]): Promise<Booking[]> {
  if (!sessionIds.length) return [];
  if (!LIVE) return mem.bookings.filter((b) => sessionIds.includes(b.sessionId));
  const { data } = await (await admin()).from("session_bookings").select("*").in("session_id", sessionIds).order("created_at");
  return (data ?? []).map(toBooking);
}
export async function bookingById(id: string): Promise<Booking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!LIVE) return mem.bookings.find((b) => b.id === id) ?? null;
  const { data } = await (await admin()).from("session_bookings").select("*").eq("id", id).maybeSingle();
  return data ? toBooking(data) : null;
}
/** One booking per person per session: re-booking after cancelling reuses the row. */
export async function upsertBooking(x: Omit<Booking, "id" | "createdAt">): Promise<Booking> {
  if (!LIVE) {
    let b = mem.bookings.find((y) => y.sessionId === x.sessionId && y.userId === x.userId);
    if (b) Object.assign(b, x, { createdAt: new Date().toISOString() });
    else mem.bookings.push((b = { ...x, id: randomUUID(), createdAt: new Date().toISOString() }));
    return b;
  }
  const { data, error } = await (await admin())
    .from("session_bookings")
    .upsert({ ...fromBooking(x), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "session_id,user_id" })
    .select("*")
    .single();
  check(error, "book");
  return toBooking(data!);
}
export async function updateBooking(id: string, patch: Partial<Booking>) {
  if (!LIVE) {
    Object.assign(mem.bookings.find((b) => b.id === id) ?? {}, patch);
    return;
  }
  const { error } = await (await admin()).from("session_bookings").update({ ...fromBooking(patch), updated_at: new Date().toISOString() }).eq("id", id);
  check(error, "update booking");
}
export async function myBookings(userId: string): Promise<Booking[]> {
  if (!LIVE) return mem.bookings.filter((b) => b.userId === userId && b.status !== "cancelled");
  const { data } = await (await admin()).from("session_bookings").select("*").eq("user_id", userId).neq("status", "cancelled");
  return (data ?? []).map(toBooking);
}

// ---- people ---------------------------------------------------------------

export interface PersonLite {
  id: string;
  name: string;
  email: string;
}
export async function people(ids: string[]): Promise<Map<string, PersonLite>> {
  const out = new Map<string, PersonLite>();
  if (!ids.length) return out;
  if (!LIVE) {
    const { profileById } = await import("../data/store");
    for (const id of ids) {
      const p = profileById(id);
      if (p) out.set(id, { id, name: `${p.firstName} ${p.lastName}`.trim(), email: p.email });
    }
    return out;
  }
  const { data } = await (await admin()).from("profiles").select("id, first_name, last_name, email").in("id", ids);
  for (const r of (data ?? []) as Row[]) out.set(String(r.id), { id: String(r.id), name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), email: String(r.email ?? "") });
  return out;
}

/** Active players and staff with accounts. */
export async function teamMemberIds(teamId: string): Promise<string[]> {
  if (!LIVE) {
    const { db } = await import("../data/store");
    return db.roster.filter((r) => r.teamId === teamId && r.status === "active" && r.userId).map((r) => r.userId!);
  }
  const { data } = await (await admin()).from("roster_members").select("user_id").eq("team_id", teamId).eq("status", "active").not("user_id", "is", null);
  return [...new Set(((data ?? []) as Row[]).map((r) => String(r.user_id)))];
}

export async function followerIds(teamId: string): Promise<string[]> {
  if (!LIVE) {
    const follows = (globalThis as unknown as { __clbxFollows?: Map<string, Set<string>> }).__clbxFollows ?? new Map();
    return [...follows.entries()].filter(([, set]) => set.has(teamId)).map(([uid]) => uid);
  }
  const { data } = await (await admin()).from("follows").select("user_id").eq("team_id", teamId);
  return ((data ?? []) as Row[]).map((r) => String(r.user_id));
}

export async function followedTeamIds(userId: string): Promise<string[]> {
  if (!LIVE) {
    const follows = (globalThis as unknown as { __clbxFollows?: Map<string, Set<string>> }).__clbxFollows ?? new Map();
    return [...(follows.get(userId) ?? [])];
  }
  const { data } = await (await admin()).from("follows").select("team_id").eq("user_id", userId);
  return ((data ?? []) as Row[]).map((r) => String(r.team_id));
}

export interface TeamBasics {
  id: string;
  name: string;
  isPublic: boolean;
  color: string;
  colorSecondary: string | null;
}
export async function teamBasics(teamId: string): Promise<TeamBasics | null> {
  if (!LIVE) {
    const { db } = await import("../data/store");
    const t = db.teams.find((x) => x.id === teamId);
    return t ? { id: t.id, name: t.name, isPublic: t.isPublic, color: t.color, colorSecondary: t.colorSecondary } : null;
  }
  const { data } = await (await admin()).from("teams").select("id, name, is_public, color, color_secondary").eq("id", teamId).maybeSingle();
  return data ? { id: String(data.id), name: String(data.name), isPublic: !!data.is_public, color: s(data.color) ?? "#1D4ED8", colorSecondary: s(data.color_secondary) } : null;
}

/** Emails (and, through the outbox, phone notifications) to a list of people. */
export async function sendEmails(list: { key: string; to: string; subject: string; text: string; links: { label: string; href: string }[] }[]) {
  if (!list.length) return;
  if (!LIVE) {
    const { queueEmail } = await import("../data/store");
    list.forEach(({ key: _key, ...m }) => queueEmail(m));
    return;
  }
  const { error } = await (await admin())
    .from("outbox")
    .upsert(list.map(({ key, ...m }) => ({ kind: "email", channel: "email", payload: m, status: "pending", dedupe_key: key })), { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) console.error("[sessions] outbox:", error.message);
  const { kickOutbox } = await import("../email/worker");
  await kickOutbox();
}
