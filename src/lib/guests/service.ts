import "server-only";
import { getSessionUser, getTeam, myPerms } from "../data";
import { APP_URL } from "../data/store";
import { eventTitle } from "../event-title";
import { formatLongDate, formatTimeRange } from "../time";
import { sign, verify } from "../tokens";
import * as st from "./store";
import type { Guest, GuestEvent, GuestResponse } from "./store";

/*
 * Guest players: people who play some of a team's games without being on its roster (the
 * Sunday pickup regulars, a ringer for one match, extras for a tournament). The team keeps a
 * guest list; whoever posts a game picks who gets it: the team only, the team and every guest
 * on the list, or the team and chosen guests. Guests get that game's updates (new, changed,
 * cancelled) and answer Going / Maybe / Can't, from the email without signing in or in the app
 * if they have an account. They never see the team's roster, chat, payments or other games.
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const fail = (error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } => ({ ok: false, error, fieldErrors });
async function caught<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    console.error("[guests]", e);
    return fail("Something went wrong. Try again.");
  }
}

export type GuestMode = "team" | "all" | "chosen";
/** Who gets a new game by default: guests come to pickup games, matches, tournaments and events, not training. */
export const defaultMode = (type: string): GuestMode => (type === "training" ? "team" : "all");

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function access(teamId: string) {
  const team = await getTeam(teamId);
  if (!team) return null;
  const p = await myPerms(teamId);
  return { team, manage: p.staff || p.games || p.events, me: p.userId };
}

export interface GuestView {
  id: string;
  name: string;
  /** Staff only. */
  email: string | null;
  hasAccount: boolean;
  games: number;
}

async function views(guests: Guest[], manage: boolean): Promise<GuestView[]> {
  const people = await st.profiles(guests.map((x) => x.userId).filter((x): x is string => !!x));
  const inv = await st.invitesForGuests(guests.map((x) => x.id));
  return guests
    .map((x) => ({
      id: x.id,
      name: (x.userId && people.get(x.userId)?.name) || x.name,
      email: manage ? (x.userId && people.get(x.userId)?.email) || x.email : null,
      hasAccount: !!x.userId,
      games: inv.filter((i) => i.guestId === x.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The team's guest list (team members see names; staff see emails and can change it). */
export async function guestList(teamId: string): Promise<{ guests: GuestView[]; manage: boolean } | null> {
  const a = await access(teamId);
  if (!a) return null;
  const all = (await st.guestsFor(teamId)).filter((x) => x.onList);
  return { guests: await views(all, a.manage), manage: a.manage };
}

/** Find someone to add: an exact email (any Clbx account), or a name among people the team already knows. */
export async function findPeople(teamId: string, q: string): Promise<Result<{ id: string; name: string; hint: string | null }[]>> {
  return caught<{ id: string; name: string; hint: string | null }[]>(async () => {
    const a = await access(teamId);
    if (!a?.manage) return fail("Only captains and managers can add guest players.");
    const term = q.trim().toLowerCase();
    if (term.length < 2) return { ok: true, data: [] };
    const [roster, guests] = await Promise.all([st.rosterUserIds(teamId), st.guestsFor(teamId)]);
    const skip = new Set([...roster, ...guests.filter((x) => x.onList && x.userId).map((x) => x.userId!)]);
    if (EMAIL.test(term)) {
      const p = await st.profileByEmail(term);
      return { ok: true, data: p && !skip.has(p.id) ? [{ id: p.id, name: p.name, hint: "Clbx account" }] : [] };
    }
    const ids = (await st.knownPeople(teamId)).filter((id) => !skip.has(id));
    const people = await st.profiles(ids);
    const hits = [...people.values()]
      .filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(term)) || p.name.toLowerCase().includes(term))
      .sort((x, y) => x.name.localeCompare(y.name))
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, hint: null }));
    return { ok: true, data: hits };
  });
}

export interface NewGuest {
  userId?: string;
  name?: string;
  email?: string;
}

/** Adds (or brings back) a guest. keep=false: a one-off for one game, not on the list. */
async function upsertGuest(teamId: string, me: string, input: NewGuest, keep: boolean): Promise<Result<Guest>> {
  const all = await st.guestsFor(teamId);
  if (input.userId) {
    if ((await st.rosterUserIds(teamId)).includes(input.userId)) return fail("They're already on the team.");
    const p = (await st.profiles([input.userId])).get(input.userId);
    if (!p) return fail("We couldn't find that person.");
    const had = all.find((x) => x.userId === input.userId || (!!x.email && x.email.toLowerCase() === p.email.toLowerCase()));
    if (had) {
      if (keep && !had.onList) await st.updateGuest(had.id, { onList: true });
      if (!had.userId) await st.updateGuest(had.id, { userId: input.userId });
      return { ok: true, data: { ...had, onList: had.onList || keep, userId: input.userId } };
    }
    return { ok: true, data: await st.insertGuest({ teamId, userId: p.id, name: p.name, email: null, onList: keep, addedBy: me }) };
  }
  const name = (input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const email = (input.email ?? "").trim().toLowerCase() || null;
  const fe: Record<string, string> = {};
  if (!name) fe.name = "Add their name.";
  if (email && !EMAIL.test(email)) fe.email = "Enter an email like sam@gmail.com, or leave it blank.";
  if (Object.keys(fe).length) return fail("Check the highlighted fields.", fe);
  // Someone with an account under that email: link them, so they see the game in the app too.
  const acct = email ? await st.profileByEmail(email) : null;
  if (acct) return upsertGuest(teamId, me, { userId: acct.id }, keep);
  const had = all.find((x) => (email && x.email === email) || (!email && !x.userId && !x.email && x.name.toLowerCase() === name.toLowerCase()));
  if (had) {
    if (keep && !had.onList) await st.updateGuest(had.id, { onList: true });
    return { ok: true, data: { ...had, onList: had.onList || keep } };
  }
  return { ok: true, data: await st.insertGuest({ teamId, userId: null, name, email, onList: keep, addedBy: me }) };
}

export async function addGuest(teamId: string, input: NewGuest): Promise<Result<{ id: string; name: string }>> {
  return caught(async () => {
    const a = await access(teamId);
    if (!a?.manage) return fail("Only captains and managers can add guest players.");
    const r = await upsertGuest(teamId, a.me, input, true);
    return r.ok ? { ok: true, data: { id: r.data.id, name: r.data.name } } : r;
  });
}

/** Takes someone off the guest list. Games they were already asked to stay as they are. */
export async function removeGuest(teamId: string, guestId: string): Promise<Result> {
  return caught(async () => {
    const a = await access(teamId);
    if (!a?.manage) return fail("Only captains and managers can change the guest list.");
    const x = await st.guestById(guestId);
    if (!x || x.teamId !== teamId) return fail("That guest isn't on this team's list.");
    await st.updateGuest(guestId, { onList: false });
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// one game: who's asked, what they said
// ---------------------------------------------------------------------------

export interface EventGuestsView {
  invited: { id: string; name: string; response: GuestResponse | null; hasAccount: boolean; onList: boolean }[];
  /** Guests on the list who aren't asked yet (staff only). */
  others: { id: string; name: string }[];
  manage: boolean;
  counts: Record<GuestResponse | "none", number>;
}

export async function eventGuests(eventId: string): Promise<EventGuestsView | null> {
  const [e] = await st.eventsById([eventId]);
  if (!e) return null;
  const a = await access(e.teamId);
  if (!a) return null;
  const [guests, inv] = await Promise.all([st.guestsFor(e.teamId), st.invitesForEvents([eventId])]);
  const people = await st.profiles(guests.map((x) => x.userId).filter((x): x is string => !!x));
  const nameOf = (x: Guest) => (x.userId && people.get(x.userId)?.name) || x.name;
  const byId = new Map(guests.map((x) => [x.id, x]));
  const invited = inv
    .map((i) => ({ i, x: byId.get(i.guestId) }))
    .filter((r): r is { i: (typeof inv)[number]; x: Guest } => !!r.x)
    .map(({ i, x }) => ({ id: x.id, name: nameOf(x), response: i.response, hasAccount: !!x.userId, onList: x.onList }))
    .sort((p, q) => p.name.localeCompare(q.name));
  const asked = new Set(invited.map((x) => x.id));
  const counts = { going: 0, maybe: 0, not_going: 0, none: 0 } as EventGuestsView["counts"];
  invited.forEach((x) => counts[x.response ?? "none"]++);
  return {
    invited,
    others: a.manage ? guests.filter((x) => x.onList && !asked.has(x.id)).map((x) => ({ id: x.id, name: nameOf(x) })).sort((p, q) => p.name.localeCompare(q.name)) : [],
    manage: a.manage,
    counts,
  };
}

/** Ask guests to a game (and the rest of its weekly series, if asked). New invitees get an email. */
export async function invite(eventId: string, who: "team" | "all" | string[], opts: { notify: boolean; series?: boolean } = { notify: true }): Promise<Result<{ count: number }>> {
  return caught(async () => {
    const [e] = await st.eventsById([eventId]);
    if (!e) return fail("That game no longer exists.");
    const a = await access(e.teamId);
    if (!a?.manage) return fail("Only captains and managers can ask guest players.");
    if (who === "team") return { ok: true, data: { count: 0 } };
    const ids = (await st.guestsFor(e.teamId)).filter((x) => (who === "all" ? x.onList : who.includes(x.id))).map((x) => x.id);
    const events = opts.series ? await st.seriesFrom(e) : [e];
    const fresh = await st.addInvites(events.flatMap((ev) => ids.map((guestId) => ({ eventId: ev.id, teamId: e.teamId, guestId }))));
    if (opts.notify && fresh.length) await mail(events[0], "new", [...new Set(fresh.filter((i) => i.eventId === events[0].id).map((i) => i.guestId))], events.length);
    return { ok: true, data: { count: new Set(fresh.map((i) => i.guestId)).size } };
  });
}

/** Add a guest straight to one game: someone from the list, a Clbx account, or a typed name. */
export async function addToEvent(eventId: string, input: NewGuest & { guestId?: string }, keep: boolean): Promise<Result<{ name: string }>> {
  return caught(async () => {
    const [e] = await st.eventsById([eventId]);
    if (!e) return fail("That game no longer exists.");
    const a = await access(e.teamId);
    if (!a?.manage) return fail("Only captains and managers can add guest players.");
    let x: Guest | null = null;
    if (input.guestId) {
      x = await st.guestById(input.guestId);
      if (!x || x.teamId !== e.teamId) return fail("That guest isn't on this team's list.");
    } else {
      const r = await upsertGuest(e.teamId, a.me, input, keep);
      if (!r.ok) return r;
      x = r.data;
    }
    const fresh = await st.addInvites([{ eventId, teamId: e.teamId, guestId: x.id }]);
    if (!fresh.length) return fail(`${x.name} is already asked to this one.`);
    await mail(e, "new", [x.id]);
    return { ok: true, data: { name: x.name } };
  });
}

export async function uninvite(eventId: string, guestId: string): Promise<Result> {
  return caught(async () => {
    const [e] = await st.eventsById([eventId]);
    if (!e) return fail("That game no longer exists.");
    const a = await access(e.teamId);
    if (!a?.manage) return fail("Only captains and managers can change who's asked.");
    await st.removeInvite(eventId, guestId);
    return { ok: true, data: undefined };
  });
}

/** Staff fill in a guest's answer (they told the captain in person). */
export async function setFor(eventId: string, guestId: string, response: GuestResponse): Promise<Result> {
  return caught(async () => {
    const [e] = await st.eventsById([eventId]);
    if (!e) return fail("That game no longer exists.");
    const a = await access(e.teamId);
    if (!a?.manage) return fail("Only captains and managers can answer for a guest.");
    if (!(await st.setResponse(eventId, guestId, response))) return fail("They aren't asked to this one.");
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// emails
// ---------------------------------------------------------------------------

export type MailKind = "new" | "changed" | "postponed" | "cancelled" | "reinstated";

async function mail(e: GuestEvent, kind: MailKind, guestIds: string[], count = 1) {
  if (!guestIds.length) return;
  const { teamBasics, sendEmails } = await import("../sessions/store");
  const team = await teamBasics(e.teamId);
  if (!team) return;
  const guests = (await st.guestsFor(e.teamId)).filter((x) => guestIds.includes(x.id));
  const people = await st.profiles(guests.map((x) => x.userId).filter((x): x is string => !!x));
  const title = eventTitle(e);
  const day = formatLongDate(e.startAt, e.tz);
  const when = `${day}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}`;
  const subject = {
    new: count > 1 ? `You're invited: ${title}, weekly from ${day}` : `You're invited: ${title} · ${day}`,
    changed: `Changed: ${title} · ${day}`,
    postponed: `Postponed: ${title}`,
    cancelled: `Cancelled: ${title} · ${day}`,
    reinstated: `Back on: ${title} · ${day}`,
  }[kind];
  const out = [];
  for (const x of guests) {
    const to = (x.userId && people.get(x.userId)?.email) || x.email;
    if (!to) continue;
    const links: { label: string; href: string }[] = [];
    if (kind !== "cancelled") {
      for (const [r, label] of [["going", "Going"], ["maybe", "Maybe"], ["not_going", "Can't make it"]] as const) {
        links.push({ label, href: `${APP_URL}/gr/${sign({ k: "guest", e: e.id, g: x.id, r }, 60 * 60 * 24 * 30)}` });
      }
    }
    if (x.userId) links.push({ label: "Open in the app", href: `${APP_URL}/guest/${e.id}` });
    out.push({
      key: `guest:${kind}:${e.id}:${x.id}:${kind === "new" ? "" : Date.now()}`,
      to,
      subject: `${team.name} · ${subject}`,
      text:
        kind === "cancelled"
          ? `${title} on ${when} is cancelled.${e.statusReason ? ` Reason: ${e.statusReason}.` : ""}`
          : `${team.name} would like you to play as a guest.\n\n${title}\n${when}${e.locationText ? `\n${e.locationText}` : ""}${e.notes ? `\n\n${e.notes}` : ""}${count > 1 ? `\n\nRepeats weekly, ${count} in total.` : ""}\n\nAre you in?`,
      links,
    });
  }
  await sendEmails(out);
}

/** After a game changes, is postponed, cancelled or back on: tell the guests who are asked. */
export async function notifyChange(eventId: string, kind: Exclude<MailKind, "new">) {
  try {
    const [e] = await st.eventsById([eventId]);
    if (!e) return;
    const inv = await st.invitesForEvents([eventId]);
    await mail(e, kind, inv.filter((i) => !(kind === "changed" && i.response === "not_going")).map((i) => i.guestId));
  } catch (err) {
    console.error("[guests] notify", err);
  }
}

/** A drop-in game was posted: everyone on the guest list hears about it. */
export async function announceSession(teamId: string, sessionId: string, line: { subject: string; text: string }, skipUserIds: string[] = []) {
  try {
    const { sendEmails } = await import("../sessions/store");
    const guests = (await st.guestsFor(teamId)).filter((x) => x.onList && !(x.userId && skipUserIds.includes(x.userId)));
    const people = await st.profiles(guests.map((x) => x.userId).filter((x): x is string => !!x));
    await sendEmails(
      guests
        .map((x) => ({ x, to: (x.userId && people.get(x.userId)?.email) || x.email }))
        .filter((r): r is { x: Guest; to: string } => !!r.to)
        .map(({ x, to }) => ({ key: `guest-session:${sessionId}:${x.id}`, to, subject: line.subject, text: line.text, links: [{ label: "Book a spot", href: `${APP_URL}/s/${sessionId}` }] })),
    );
  } catch (err) {
    console.error("[guests] session", err);
  }
}

// ---------------------------------------------------------------------------
// the guest's side
// ---------------------------------------------------------------------------

/** One tap from the email, no sign-in needed. */
export async function answerFromLink(token: string): Promise<Result<{ title: string; when: string; team: string; response: GuestResponse; name: string }>> {
  return caught(async () => {
    const t = verify<{ k: string; e: string; g: string; r: GuestResponse }>(token);
    if (!t || t.k !== "guest" || !["going", "maybe", "not_going"].includes(t.r)) return fail("This link has expired. Ask the captain to send a new one.");
    const [e] = await st.eventsById([t.e]);
    const x = await st.guestById(t.g);
    if (!e || !x || x.teamId !== e.teamId) return fail("That game no longer exists.");
    if (e.status === "cancelled") return fail("That game is cancelled.");
    if (!(await st.setResponse(e.id, x.id, t.r))) return fail("You're no longer asked to this one.");
    const { teamBasics } = await import("../sessions/store");
    const team = await teamBasics(e.teamId);
    return { ok: true, data: { title: eventTitle(e), when: `${formatLongDate(e.startAt, e.tz)}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}`, team: team?.name ?? "", response: t.r, name: x.name } };
  });
}

export interface MyGuestGame {
  event: GuestEvent;
  guestId: string;
  team: { id: string; name: string; color: string };
  response: GuestResponse | null;
  going: number;
}

/** The games I'm asked to as a guest (signed in), soonest first. */
export async function myGuestGames(opts: { past?: boolean } = {}): Promise<MyGuestGame[]> {
  const u = await getSessionUser();
  if (!u) return [];
  const mine = await st.guestRowsForUser(u.id);
  if (!mine.length) return [];
  const inv = await st.invitesForGuests(mine.map((x) => x.id));
  const events = await st.eventsById([...new Set(inv.map((i) => i.eventId))]);
  const cutoff = Date.now() - 2 * 3600 * 1000;
  const shown = events.filter((e) => (opts.past ? true : Date.parse(e.endAt) >= cutoff)).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const { teamBasics } = await import("../sessions/store");
  const teams = new Map<string, { id: string; name: string; color: string }>();
  for (const id of [...new Set(shown.map((e) => e.teamId))]) {
    const t = await teamBasics(id);
    if (t) teams.set(id, { id: t.id, name: t.name, color: t.color });
  }
  const { getAvailabilityCounts } = await import("./counts");
  return Promise.all(
    shown
      .filter((e) => teams.has(e.teamId))
      .map(async (e) => {
        const i = inv.find((x) => x.eventId === e.id)!;
        return { event: e, guestId: i.guestId, team: teams.get(e.teamId)!, response: i.response, going: await getAvailabilityCounts(e.id, e.teamId) };
      }),
  );
}

export async function myGuestGame(eventId: string): Promise<MyGuestGame | null> {
  return (await myGuestGames({ past: true })).find((g) => g.event.id === eventId) ?? null;
}

/** A signed-in guest answers in the app. */
export async function answerAsMe(eventId: string, response: GuestResponse): Promise<Result> {
  return caught(async () => {
    const g = await myGuestGame(eventId);
    if (!g) return fail("You're not asked to this one.");
    if (g.event.status === "cancelled") return fail("That game is cancelled.");
    await st.setResponse(eventId, g.guestId, response);
    return { ok: true, data: undefined };
  });
}

/** The team's guest list, for a tournament roster (the tournament checks the person may edit it). */
export async function tournamentGuests(teamId: string): Promise<{ id: string; userId: string | null; name: string }[]> {
  const guests = (await st.guestsFor(teamId)).filter((x) => x.onList);
  const people = await st.profiles(guests.map((x) => x.userId).filter((x): x is string => !!x));
  return guests.map((x) => ({ id: x.id, userId: x.userId, name: (x.userId && people.get(x.userId)?.name) || x.name })).sort((a, b) => a.name.localeCompare(b.name));
}
