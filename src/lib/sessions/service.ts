import "server-only";
import { APP_URL } from "../data/store";
import { getSessionUser, myPerms } from "../data";
import { setFollow } from "../fans";
import { DEFAULT_TZ, formatLongDate, formatTimeRange, utcToZoned, zonedToUtc } from "../time";
import * as st from "./store";
import type { Booking, Series, Session } from "./store";

/*
 * Game sessions: drop-in games a team posts (one-off or every week) for its own players and
 * its supporters (followers). Some spots can be held for the team's players until a set time
 * before kick-off; the rest are open. Full sessions take a waitlist; a cancelled spot goes to
 * the next person on it. Weekly sessions post themselves on schedule and notify everyone.
 * Paying: by card when the team collects online (the spot is held 20 minutes while they pay),
 * otherwise at the door or by e-Transfer and staff tick it off.
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const fail = (error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } => ({ ok: false, error, fieldErrors });
const HOLD_MINUTES = 20;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const money = (c: number) => (c ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "Free");

async function me() {
  return getSessionUser();
}
async function canManage(teamId: string) {
  const p = await myPerms(teamId).catch(() => null);
  return !!p && (p.events || p.staff);
}
async function isMember(uid: string | null | undefined, teamId: string) {
  return !!uid && (await st.teamMemberIds(teamId)).includes(uid);
}

// ---------------------------------------------------------------------------
// spots
// ---------------------------------------------------------------------------

const live = (b: Booking, nowMs: number) => b.status === "booked" || (b.status === "held" && !!b.holdUntil && Date.parse(b.holdUntil) > nowMs);

export function spots(s: Session, bookings: Booking[], nowMs = Date.now()) {
  const taken = bookings.filter((b) => b.sessionId === s.id && live(b, nowMs));
  const members = taken.filter((b) => b.member).length;
  const others = taken.length - members;
  const releasedHeld = !!s.releaseAt && nowMs >= Date.parse(s.releaseAt);
  const held = releasedHeld ? 0 : Math.min(s.memberSpots, s.capacity);
  const openLeft = Math.max(0, s.capacity - Math.max(members, held) - others);
  const memberLeft = Math.max(0, s.capacity - taken.length);
  const waitlist = bookings.filter((b) => b.sessionId === s.id && b.status === "waitlist").length;
  return { taken: taken.length, members, others, held, heldLeft: Math.max(0, held - members), openLeft, memberLeft, waitlist };
}

// ---------------------------------------------------------------------------
// weekly sessions: post on schedule, announce
// ---------------------------------------------------------------------------

function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** The next few dates of a weekly session, with when each one gets posted. */
export function occurrences(x: Series, fromIso = new Date().toISOString(), count = 4) {
  const today = utcToZoned(fromIso, x.tz).date;
  let d = addDays(today, (x.weekday - weekdayOf(today) + 7) % 7);
  const out: { date: string; startsAt: string; endsAt: string; postAt: string; skipped: boolean }[] = [];
  for (let i = 0; out.length < count && i < count + 2; i++, d = addDays(d, 7)) {
    const startsAt = zonedToUtc(d, x.startTime, x.tz);
    if (startsAt <= fromIso) continue;
    let endsAt = zonedToUtc(d, x.endTime, x.tz);
    if (endsAt <= startsAt) endsAt = zonedToUtc(addDays(d, 1), x.endTime, x.tz); // runs past midnight
    out.push({ date: d, startsAt, endsAt, postAt: zonedToUtc(addDays(d, -x.postDaysBefore), x.postTime, x.tz), skipped: x.skipDates.includes(d) });
  }
  return out;
}

async function announce(s: Session) {
  if (!(await st.updateSession(s.id, { announcedAt: new Date().toISOString() }, true))) return; // someone else did
  await st.syncCalendarEvent(s);
  const team = await st.teamBasics(s.teamId);
  if (!team) return;
  const ids = [...new Set([...(await st.teamMemberIds(s.teamId)), ...(team.isPublic ? await st.followerIds(s.teamId) : [])])].filter((id) => id !== s.createdBy);
  const who = await st.people(ids);
  const sp = spots(s, []);
  const when = `${formatLongDate(s.startsAt, s.tz)}, ${formatTimeRange(s.startsAt, s.endsAt, s.tz)}`;
  await st.sendEmails(
    [...who.values()].filter((p) => p.email).map((p) => ({
      key: `session:${s.id}:${p.id}`,
      to: p.email,
      subject: `${team.name} · ${s.title}, ${formatLongDate(s.startsAt, s.tz)}`,
      text: `${when}${s.venueName ? ` at ${s.venueName}` : ""}. ${money(s.priceCents)} to play. ${s.capacity} spots${sp.held ? ` (${sp.held} kept for ${team.name} players)` : ""}. Book yours before it fills up.`,
      links: [{ label: "Book a spot", href: `${APP_URL}/s/${s.id}` }],
    })),
  );
}

/** Posts weekly sessions that are due and announces newly posted ones. Safe to run often. */
export async function runDue(nowIso = new Date().toISOString()) {
  for (const x of await st.activeSeries()) {
    for (const o of occurrences(x, nowIso, 2)) {
      if (o.skipped || o.postAt > nowIso || (await st.seriesHasSession(x.id, o.startsAt))) continue;
      await st.insertSession({
        teamId: x.teamId, seriesId: x.id, title: x.title, startsAt: o.startsAt, endsAt: o.endsAt, tz: x.tz, venueName: x.venueName, venueAddress: x.venueAddress,
        priceCents: x.priceCents, capacity: x.capacity, memberSpots: x.memberSpots,
        releaseAt: x.releaseHours != null && x.memberSpots ? new Date(Date.parse(o.startsAt) - x.releaseHours * 3600_000).toISOString() : null,
        notes: x.notes, status: "scheduled", postAt: o.postAt, announcedAt: null, createdBy: x.createdBy,
      });
    }
  }
  for (const s of await st.unannounced(nowIso)) await announce(s);
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------

export interface SessionCard {
  id: string;
  teamId: string;
  teamName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  tz: string;
  venueName: string | null;
  priceCents: number;
  capacity: number;
  spots: ReturnType<typeof spots>;
  posted: boolean;
  postAt: string;
  cancelled: boolean;
  weekly: boolean;
  mine: Booking["status"] | null;
}

function card(s: Session, teamName: string, bookings: Booking[], uid: string | null): SessionCard {
  const mine = uid ? bookings.find((b) => b.sessionId === s.id && b.userId === uid && b.status !== "cancelled") : undefined;
  return {
    id: s.id, teamId: s.teamId, teamName, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, tz: s.tz, venueName: s.venueName, priceCents: s.priceCents, capacity: s.capacity,
    spots: spots(s, bookings), posted: Date.parse(s.postAt) <= Date.now(), postAt: s.postAt, cancelled: s.status === "cancelled", weekly: !!s.seriesId,
    mine: mine ? (mine.status === "held" && (!mine.holdUntil || Date.parse(mine.holdUntil) <= Date.now()) ? null : mine.status) : null,
  };
}

export interface SeriesView extends Series {
  next: { date: string; startsAt: string; postAt: string; skipped: boolean }[];
}

/** The team's Sessions tab. Staff also see sessions not posted yet and the weekly ones. */
export async function teamSessions(teamId: string) {
  await runDue().catch((e) => console.error("[sessions] runDue", e));
  const u = await me();
  const team = await st.teamBasics(teamId);
  if (!u || !team) return null;
  const manage = await canManage(teamId);
  if (!manage && !(await isMember(u.id, teamId))) return null;
  const list = (await st.sessionsFor(teamId, new Date().toISOString())).filter((s) => manage || (Date.parse(s.postAt) <= Date.now() && s.status === "scheduled"));
  const bookings = await st.bookingsFor(list.map((s) => s.id));
  const series: SeriesView[] = manage ? (await st.seriesFor(teamId)).map((x) => ({ ...x, next: occurrences(x).slice(0, 3) })) : [];
  return { team, manage, sessions: list.map((s) => card(s, team.name, bookings, u.id)), series };
}

/** Upcoming posted sessions for the fan page. */
export async function publicSessions(teamId: string): Promise<SessionCard[]> {
  await runDue().catch(() => {});
  const team = await st.teamBasics(teamId);
  if (!team) return [];
  const u = await me();
  const list = (await st.sessionsFor(teamId, new Date().toISOString())).filter((s) => Date.parse(s.postAt) <= Date.now() && s.status === "scheduled");
  const bookings = await st.bookingsFor(list.map((s) => s.id));
  return list.slice(0, 8).map((s) => card(s, team.name, bookings, u?.id ?? null));
}

/** Home: sessions from teams I follow or play for that I can still join, and ones I've booked. */
export async function sessionsForMe(teamIds: string[]): Promise<SessionCard[]> {
  const u = await me();
  if (!u) return [];
  const ids = [...new Set([...teamIds, ...(await st.followedTeamIds(u.id))])];
  const list = await st.sessionsForTeams(ids, new Date().toISOString(), new Date().toISOString());
  const bookings = await st.bookingsFor(list.map((s) => s.id));
  const names = new Map<string, string>();
  for (const id of new Set(list.map((s) => s.teamId))) names.set(id, (await st.teamBasics(id))?.name ?? "");
  return list.slice(0, 6).map((s) => card(s, names.get(s.teamId) ?? "", bookings, u.id));
}

export interface SessionPage {
  s: Session;
  team: st.TeamBasics;
  spots: ReturnType<typeof spots>;
  signedIn: boolean;
  member: boolean;
  manage: boolean;
  mine: Booking | null;
  /** Where I'd be: an open spot, a held one (players), or the waitlist. */
  canBook: "open" | "member" | "waitlist" | null;
  started: boolean;
  /** Staff only. */
  people: { bookingId: string; name: string; status: Booking["status"]; member: boolean; paid: Booking["paid"] }[];
  waitPos: number | null;
}

export async function sessionPage(id: string): Promise<SessionPage | null> {
  const s = await st.sessionById(id);
  if (!s) return null;
  const team = await st.teamBasics(s.teamId);
  if (!team) return null;
  const u = await me();
  const member = await isMember(u?.id, s.teamId);
  const manage = !!u && (await canManage(s.teamId));
  const posted = Date.parse(s.postAt) <= Date.now();
  if (!manage && (!posted || (!team.isPublic && !member))) return null;
  const bookings = await st.bookingsFor([s.id]);
  const sp = spots(s, bookings);
  const now = Date.now();
  const mineRaw = u ? bookings.find((b) => b.userId === u.id && b.status !== "cancelled") ?? null : null;
  const mine = mineRaw && mineRaw.status === "held" && (!mineRaw.holdUntil || Date.parse(mineRaw.holdUntil) <= now) ? null : mineRaw;
  const started = Date.parse(s.startsAt) <= now;
  const canBook = !u || mine || started || s.status !== "scheduled" ? null : member ? (sp.memberLeft > 0 ? "member" : "waitlist") : sp.openLeft > 0 ? "open" : "waitlist";
  let list: SessionPage["people"] = [];
  if (manage) {
    const who = await st.people(bookings.map((b) => b.userId));
    list = bookings
      .filter((b) => b.status === "booked" || b.status === "waitlist" || (b.status === "held" && live(b, now)))
      .map((b) => ({ bookingId: b.id, name: who.get(b.userId)?.name ?? "Someone", status: b.status, member: b.member, paid: b.paid }));
  }
  const waiting = bookings.filter((b) => b.status === "waitlist").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const waitPos = mine?.status === "waitlist" ? waiting.findIndex((b) => b.id === mine.id) + 1 : null;
  return { s, team, spots: sp, signedIn: !!u, member, manage, mine, canBook, started, people: list, waitPos };
}

// ---------------------------------------------------------------------------
// booking
// ---------------------------------------------------------------------------

/** Book a spot (or join the waitlist). With card payments on, returns where to pay. */
export async function book(sessionId: string): Promise<Result<{ status: Booking["status"]; payUrl?: string }>> {
  const u = await me();
  if (!u) return fail("Sign in to book.");
  const p = await sessionPage(sessionId);
  if (!p) return fail("That session isn't open.");
  if (p.mine) return fail(p.mine.status === "waitlist" ? "You're already on the waitlist." : "You've already got a spot.");
  if (!p.canBook) return fail(p.started ? "This session has started." : "This session isn't taking bookings.");
  const status: Booking["status"] = p.canBook === "waitlist" ? "waitlist" : "booked";
  if (!p.member && p.team.isPublic) await setFollow(p.team.id, true).catch(() => {}); // supporters who book follow the team
  const { teamCollector } = await import("../payments/service");
  const online = status === "booked" && p.s.priceCents > 0 && (await teamCollector(p.s.teamId)).active;
  const b = await st.upsertBooking({
    sessionId, userId: u.id, status: online ? "held" : status, member: p.member, paid: null,
    holdUntil: online ? new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString() : null,
  });
  if (online) {
    const { startCheckout } = await import("../payments/service");
    const r = await startCheckout({ kind: "session", refId: b.id, scopeId: p.s.teamId });
    if (!r.ok) {
      await st.updateBooking(b.id, { status: "cancelled", holdUntil: null });
      return fail(r.error);
    }
    return { ok: true, data: { status: "held", payUrl: r.data.url } };
  }
  return { ok: true, data: { status } };
}

/** Pay for a spot I already have (booked before card payments, or my hold ran out). */
export async function payForBooking(sessionId: string): Promise<Result<{ url: string }>> {
  const u = await me();
  const p = await sessionPage(sessionId);
  if (!u || !p?.mine || p.mine.paid || p.mine.status !== "booked") return fail("Nothing to pay here.");
  const { startCheckout } = await import("../payments/service");
  return startCheckout({ kind: "session", refId: p.mine.id, scopeId: p.s.teamId });
}

/** For lib/payments: the booking a card payment is for. */
export async function bookingForPayment(bookingId: string, uid: string) {
  const b = await st.bookingById(bookingId);
  if (!b || b.userId !== uid || b.paid || !["held", "booked"].includes(b.status)) return null;
  const s = await st.sessionById(b.sessionId);
  const team = s ? await st.teamBasics(s.teamId) : null;
  if (!s || !team || !s.priceCents) return null;
  return { amountCents: s.priceCents, label: `${team.name} · ${s.title} (${formatLongDate(s.startsAt, s.tz)})`, teamId: s.teamId, back: `/s/${s.id}` };
}

/** Card payment went through: the spot is theirs. */
export async function bookingPaid(bookingId: string) {
  const b = await st.bookingById(bookingId);
  if (!b) return;
  await st.updateBooking(b.id, { status: b.status === "cancelled" ? "cancelled" : "booked", paid: "card", holdUntil: null });
}

async function promote(s: Session, team: { name: string }) {
  const bookings = await st.bookingsFor([s.id]);
  const sp = spots(s, bookings);
  const waiting = bookings.filter((b) => b.status === "waitlist").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const next = waiting.find((b) => (b.member ? sp.memberLeft > 0 : sp.openLeft > 0));
  if (!next) return;
  await st.updateBooking(next.id, { status: "booked" });
  const who = (await st.people([next.userId])).get(next.userId);
  if (who?.email)
    await st.sendEmails([
      {
        key: `session-in:${s.id}:${next.userId}:${Date.now()}`,
        to: who.email,
        subject: `${team.name} · You're in: ${s.title}, ${formatLongDate(s.startsAt, s.tz)}`,
        text: `A spot opened up and it's yours. ${formatTimeRange(s.startsAt, s.endsAt, s.tz)}${s.venueName ? ` at ${s.venueName}` : ""}. Can't make it any more? Cancel so the next person gets it.`,
        links: [{ label: "See your spot", href: `${APP_URL}/s/${s.id}` }],
      },
    ]);
}

export async function cancelMyBooking(sessionId: string): Promise<Result> {
  const u = await me();
  const p = await sessionPage(sessionId);
  if (!u || !p?.mine) return fail("You're not booked on this one.");
  const had = p.mine.status === "booked" || p.mine.status === "held";
  await st.updateBooking(p.mine.id, { status: "cancelled", holdUntil: null });
  if (had) await promote(p.s, p.team);
  return { ok: true, data: undefined };
}

/** Staff: tick off cash, or remove someone. */
export async function staffBooking(sessionId: string, bookingId: string, op: "cash" | "uncash" | "remove"): Promise<Result> {
  const s = await st.sessionById(sessionId);
  if (!s || !(await canManage(s.teamId))) return fail("Only team staff can do that.");
  const b = await st.bookingById(bookingId);
  if (!b || b.sessionId !== s.id) return fail("That booking isn't on this session.");
  if (op === "cash") await st.updateBooking(b.id, { paid: "cash" });
  if (op === "uncash") {
    if (b.paid === "card") return fail("They paid by card.");
    await st.updateBooking(b.id, { paid: null });
  }
  if (op === "remove") {
    await st.updateBooking(b.id, { status: "cancelled", holdUntil: null });
    const team = await st.teamBasics(s.teamId);
    if (team && b.status !== "waitlist") await promote(s, team);
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// creating and changing sessions
// ---------------------------------------------------------------------------

export interface SessionInput {
  title: string;
  date?: string; // one-off
  weekday?: string; // weekly
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  price: string;
  capacity: string;
  memberSpots: string;
  releaseHours: string; // "" = held until kick-off
  notes: string;
  postWhen?: "now" | "later"; // one-off
  postDate?: string;
  postTime?: string;
  postDaysBefore?: string; // weekly
}

function validate(input: SessionInput, weekly: boolean) {
  const fe: Record<string, string> = {};
  const title = input.title.trim() || "Drop-in game";
  if (title.length > 80) fe.title = "Keep it under 80 characters.";
  if (!weekly && !/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) fe.date = "Pick a date.";
  const weekday = Number(input.weekday);
  if (weekly && !(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) fe.weekday = "Pick a day.";
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) fe.startTime = "Pick a start time.";
  if (!/^\d{2}:\d{2}$/.test(input.endTime)) fe.endTime = "Pick an end time.";
  const priceRaw = input.price.replace(/[$,\s]/g, "");
  const priceCents = priceRaw ? Math.round(Number(priceRaw) * 100) : 0;
  if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 100_000) fe.price = "Use an amount from 0 to 1000, like 8.";
  const capacity = Number(input.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) fe.capacity = "How many can play? 1 to 500.";
  const memberSpots = input.memberSpots.trim() ? Number(input.memberSpots) : 0;
  if (!Number.isInteger(memberSpots) || memberSpots < 0 || (Number.isInteger(capacity) && memberSpots > capacity)) fe.memberSpots = "Up to the number of spots.";
  const releaseHours = input.releaseHours.trim() ? Number(input.releaseHours) : null;
  if (releaseHours !== null && (!Number.isInteger(releaseHours) || releaseHours < 0 || releaseHours > 336)) fe.releaseHours = "Use 0 to 336 hours.";
  const postDaysBefore = weekly ? Number(input.postDaysBefore ?? "6") : 0;
  if (weekly && !(Number.isInteger(postDaysBefore) && postDaysBefore >= 0 && postDaysBefore <= 27)) fe.postDaysBefore = "Use 0 to 27 days.";
  const postTime = input.postTime || "09:00";
  if ((weekly || input.postWhen === "later") && !/^\d{2}:\d{2}$/.test(postTime)) fe.postTime = "Pick a time.";
  if (!weekly && input.postWhen === "later" && !/^\d{4}-\d{2}-\d{2}$/.test(input.postDate ?? "")) fe.postDate = "Pick the day it goes up.";
  return {
    fe, title, weekday, priceCents, capacity, memberSpots, releaseHours, postDaysBefore, postTime,
    venueName: input.venueName.trim().slice(0, 120) || null, venueAddress: input.venueAddress.trim().slice(0, 200) || null, notes: input.notes.trim().slice(0, 1000) || null,
  };
}

export async function createSession(teamId: string, input: SessionInput): Promise<Result<{ id: string }>> {
  const u = await me();
  if (!u || !(await canManage(teamId))) return fail("Only team staff can post sessions.");
  const v = validate(input, false);
  const tz = DEFAULT_TZ;
  let startsAt = "",
    endsAt = "";
  if (!Object.keys(v.fe).length) {
    startsAt = zonedToUtc(input.date!, input.startTime, tz);
    endsAt = zonedToUtc(input.date!, input.endTime, tz);
    if (endsAt <= startsAt) endsAt = zonedToUtc(addDays(input.date!, 1), input.endTime, tz);
    if (startsAt <= new Date().toISOString()) v.fe.date = "That's in the past.";
  }
  const postAt = input.postWhen === "later" && input.postDate ? zonedToUtc(input.postDate, v.postTime, tz) : new Date().toISOString();
  if (!v.fe.date && postAt >= startsAt && input.postWhen === "later") v.fe.postDate = "Post it before the session starts.";
  if (Object.keys(v.fe).length) return fail("Check the highlighted fields.", v.fe);
  const s = await st.insertSession({
    teamId, seriesId: null, title: v.title, startsAt, endsAt, tz, venueName: v.venueName, venueAddress: v.venueAddress, priceCents: v.priceCents, capacity: v.capacity,
    memberSpots: v.memberSpots, releaseAt: v.releaseHours != null && v.memberSpots ? new Date(Date.parse(startsAt) - v.releaseHours * 3600_000).toISOString() : null,
    notes: v.notes, status: "scheduled", postAt, announcedAt: null, createdBy: u.id,
  });
  if (s && postAt <= new Date().toISOString()) await announce(s);
  return { ok: true, data: { id: s!.id } };
}

export async function createSeries(teamId: string, input: SessionInput): Promise<Result<{ id: string }>> {
  const u = await me();
  if (!u || !(await canManage(teamId))) return fail("Only team staff can set up weekly sessions.");
  const v = validate(input, true);
  if (Object.keys(v.fe).length) return fail("Check the highlighted fields.", v.fe);
  const x = await st.insertSeries({
    teamId, title: v.title, weekday: v.weekday, startTime: input.startTime, endTime: input.endTime, tz: DEFAULT_TZ, venueName: v.venueName, venueAddress: v.venueAddress,
    priceCents: v.priceCents, capacity: v.capacity, memberSpots: v.memberSpots, releaseHours: v.releaseHours, postDaysBefore: v.postDaysBefore, postTime: v.postTime,
    notes: v.notes, skipDates: [], active: true, createdBy: u.id,
  });
  await runDue();
  return { ok: true, data: { id: x.id } };
}

export async function setSeriesActive(seriesId: string, active: boolean): Promise<Result> {
  const x = await st.seriesById(seriesId);
  if (!x || !(await canManage(x.teamId))) return fail("Only team staff can change weekly sessions.");
  await st.updateSeries(x.id, { active });
  if (active) await runDue();
  return { ok: true, data: undefined };
}

/** Skip one week of a weekly session (cancels it if it's already posted). */
export async function skipWeek(seriesId: string, date: string, skip: boolean): Promise<Result> {
  const x = await st.seriesById(seriesId);
  if (!x || !(await canManage(x.teamId))) return fail("Only team staff can change weekly sessions.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  await st.updateSeries(x.id, { skipDates: skip ? [...new Set([...x.skipDates, date])] : x.skipDates.filter((d) => d !== date) });
  if (skip) {
    const startsAt = zonedToUtc(date, x.startTime, x.tz);
    const existing = (await st.sessionsFor(x.teamId, startsAt)).find((s) => s.seriesId === x.id && s.startsAt === startsAt);
    if (existing) await cancelSession(existing.id);
  }
  return { ok: true, data: undefined };
}

export async function cancelSession(sessionId: string): Promise<Result> {
  const s = await st.sessionById(sessionId);
  if (!s || !(await canManage(s.teamId))) return fail("Only team staff can cancel sessions.");
  if (s.status === "cancelled") return { ok: true, data: undefined };
  await st.updateSession(s.id, { status: "cancelled" });
  if (s.announcedAt) await st.syncCalendarEvent({ ...s, status: "cancelled" });
  const team = await st.teamBasics(s.teamId);
  const bookings = (await st.bookingsFor([s.id])).filter((b) => b.status !== "cancelled");
  const who = await st.people(bookings.map((b) => b.userId));
  await st.sendEmails(
    bookings
      .map((b) => who.get(b.userId))
      .filter((p): p is st.PersonLite => !!p?.email)
      .map((p) => ({
        key: `session-cancel:${s.id}:${p.id}`,
        to: p.email,
        subject: `${team?.name ?? "Clbx"} · Cancelled: ${s.title}, ${formatLongDate(s.startsAt, s.tz)}`,
        text: `Sorry, ${s.title} on ${formatLongDate(s.startsAt, s.tz)} is cancelled.${bookings.some((b) => b.paid === "card") ? " If you paid by card, the organiser will sort out your refund." : ""}`,
        links: [{ label: "See other sessions", href: `${APP_URL}/f/${s.teamId}` }],
      })),
  );
  return { ok: true, data: undefined };
}
