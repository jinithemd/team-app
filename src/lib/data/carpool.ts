import "server-only";
import type { ActionResult, ID, Person } from "./types";
import { db, eventById, hasEventPerm, isTeamMember, myRow, newId, personOf, queueEmail, APP_URL, requireUser, teamById } from "./store";
import { eventTitle } from "../event-title";
import { formatLongDate } from "../time";

/*
 * Carpools: drivers offer seats, riders take one or ask for a lift, and whoever runs the
 * event can move people between cars. Seat limits are checked the same way as the SQL
 * trigger (check_ride_seats): a full car refuses the next rider.
 */

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function taken(offerId: ID) {
  return db.rideRequests.filter((r) => r.offerId === offerId).length;
}

export interface CarpoolView {
  canManage: boolean;
  me: ID;
  myOfferId: ID | null;
  myRequest: { id: ID; offerId: ID | null } | null;
  offers: { id: ID; driver: Person; seats: number; leavesAt: string; from: string; note: string | null; riders: { requestId: ID; person: Person }[]; free: number }[];
  waiting: { requestId: ID; person: Person; from: string | null }[];
  totals: { cars: number; free: number; waiting: number };
}

export async function getCarpool(eventId: ID): Promise<CarpoolView | null> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  const offers = db.rideOffers
    .filter((o) => o.eventId === eventId)
    .map((o) => {
      const riders = db.rideRequests.filter((r) => r.offerId === o.id).map((r) => ({ requestId: r.id, person: personOf(r.userId) }));
      return { id: o.id, driver: personOf(o.driverId), seats: o.seats, leavesAt: o.leavesAt, from: o.from, note: o.note, riders, free: Math.max(0, o.seats - riders.length) };
    })
    .sort((a, b) => b.free - a.free || a.leavesAt.localeCompare(b.leavesAt));
  const waiting = db.rideRequests
    .filter((r) => r.eventId === eventId && !r.offerId)
    .map((r) => ({ requestId: r.id, person: personOf(r.userId), from: r.from }));
  const mine = db.rideRequests.find((r) => r.eventId === eventId && r.userId === user.id);
  return {
    canManage: hasEventPerm(user.id, eventId, "carpools"),
    me: user.id,
    myOfferId: db.rideOffers.find((o) => o.eventId === eventId && o.driverId === user.id)?.id ?? null,
    myRequest: mine ? { id: mine.id, offerId: mine.offerId } : null,
    offers,
    waiting,
    totals: { cars: offers.length, free: offers.reduce((n, o) => n + o.free, 0), waiting: waiting.length },
  };
}

/** Short summary for the event page. */
export async function carpoolSummary(eventId: ID) {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  const offers = db.rideOffers.filter((o) => o.eventId === eventId);
  const free = offers.reduce((n, o) => n + Math.max(0, o.seats - taken(o.id)), 0);
  const waiting = db.rideRequests.filter((r) => r.eventId === eventId && !r.offerId).length;
  const mine = db.rideRequests.find((r) => r.eventId === eventId && r.userId === user.id);
  const driving = offers.some((o) => o.driverId === user.id);
  return { cars: offers.length, free, waiting, driving, riding: !!mine?.offerId, asked: !!mine && !mine.offerId };
}

function guard(uid: ID, eventId: ID): string | null {
  const e = eventById(eventId);
  if (!e) return "That event no longer exists.";
  if (e.status === "cancelled") return "This event was cancelled.";
  if (Date.parse(e.endAt) < Date.now()) return "This event is over.";
  if (!myRow(uid, e.teamId)) return "Only people on the team can use the carpool.";
  return null;
}

export async function offerRide(eventId: ID, input: { seats: number; leavesAt: string; from: string; note?: string }): Promise<ActionResult> {
  const user = await requireUser();
  const err = guard(user.id, eventId);
  if (err) return { ok: false, error: err };
  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 8) fieldErrors.seats = "1 to 8 seats.";
  if (!TIME_RE.test(input.leavesAt)) fieldErrors.leavesAt = "Pick a time.";
  if (!input.from.trim()) fieldErrors.from = "Say where you're leaving from.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const existing = db.rideOffers.find((o) => o.eventId === eventId && o.driverId === user.id);
  if (existing) {
    if (input.seats < taken(existing.id)) return { ok: false, error: `${taken(existing.id)} people already have a seat. Move someone first.`, fieldErrors: { seats: "Fewer seats than riders." } };
    Object.assign(existing, { seats: input.seats, leavesAt: input.leavesAt, from: input.from.trim(), note: input.note?.trim() || null });
  } else {
    db.rideRequests = db.rideRequests.filter((r) => !(r.eventId === eventId && r.userId === user.id)); // a driver doesn't need a lift
    db.rideOffers.push({ id: newId(), eventId, driverId: user.id, seats: input.seats, leavesAt: input.leavesAt, from: input.from.trim(), note: input.note?.trim() || null });
  }
  return { ok: true, data: undefined };
}

export async function cancelOffer(eventId: ID): Promise<ActionResult<{ moved: number }>> {
  const user = await requireUser();
  const o = db.rideOffers.find((x) => x.eventId === eventId && x.driverId === user.id);
  if (!o) return { ok: false, error: "You're not driving." };
  const riders = db.rideRequests.filter((r) => r.offerId === o.id);
  riders.forEach((r) => (r.offerId = null)); // back to needing a lift
  db.rideOffers = db.rideOffers.filter((x) => x !== o);
  const e = eventById(eventId)!;
  for (const r of riders) {
    const p = db.profiles.find((x) => x.id === r.userId);
    if (p)
      queueEmail({
        to: p.email,
        subject: `${teamById(e.teamId)!.name} · Your lift for ${eventTitle(e)} fell through`,
        text: `${user.firstName} can't drive on ${formatLongDate(e.startAt, e.tz)} any more. Pick another car.`,
        links: [{ label: "Open the carpool", href: `${APP_URL}/t/${e.teamId}/e/${e.id}/carpool` }],
      });
  }
  return { ok: true, data: { moved: riders.length } };
}

/** Take a seat in a car, or pass null to ask for a lift without picking a car. */
export async function takeSeat(eventId: ID, offerId: ID | null, from?: string): Promise<ActionResult> {
  const user = await requireUser();
  const err = guard(user.id, eventId);
  if (err) return { ok: false, error: err };
  if (db.rideOffers.some((o) => o.eventId === eventId && o.driverId === user.id)) return { ok: false, error: "You're driving, so you've got a seat." };
  return seat(eventId, user.id, offerId, from);
}

function seat(eventId: ID, userId: ID, offerId: ID | null, from?: string): ActionResult {
  let r = db.rideRequests.find((x) => x.eventId === eventId && x.userId === userId);
  if (offerId) {
    const o = db.rideOffers.find((x) => x.id === offerId && x.eventId === eventId);
    if (!o) return { ok: false, error: "That car isn't going any more." };
    if (r?.offerId === offerId) return { ok: true, data: undefined };
    if (taken(o.id) >= o.seats) return { ok: false, error: "This car is full." };
  }
  if (!r) {
    r = { id: newId(), eventId, userId, from: from?.trim() || null, offerId: null };
    db.rideRequests.push(r);
  }
  r.offerId = offerId;
  if (from !== undefined) r.from = from.trim() || null;
  return { ok: true, data: undefined };
}

export async function leaveCarpool(eventId: ID): Promise<ActionResult> {
  const user = await requireUser();
  db.rideRequests = db.rideRequests.filter((r) => !(r.eventId === eventId && r.userId === user.id));
  return { ok: true, data: undefined };
}

/** Whoever runs the event moves a rider into a car (or back to waiting). */
export async function assignRider(eventId: ID, requestId: ID, offerId: ID | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasEventPerm(user.id, eventId, "carpools")) return { ok: false, error: "Only whoever runs this event can move people between cars." };
  const r = db.rideRequests.find((x) => x.id === requestId && x.eventId === eventId);
  if (!r) return { ok: false, error: "They've already sorted their lift." };
  return seat(eventId, r.userId, offerId);
}
