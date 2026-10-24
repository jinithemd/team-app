import "server-only";
import { randomUUID } from "node:crypto";
import { getSessionUserId, setSessionUserId, clearSession } from "./session";
import { sign, verify } from "../tokens";
import { DEFAULT_TZ, utcToZoned, zonedToUtc, formatLongDate, formatTimeRange } from "../time";
import type {
  ActionResult,
  Availability,
  EventType,
  EventWithMine,
  Guardian,
  ID,
  MyTeam,
  OutboxEmail,
  Person,
  Profile,
  RosterMember,
  RosterRow,
  Rsvp,
  RsvpResponse,
  StaffPermission,
  StaffRole,
  Team,
  TeamEvent,
} from "./types";
import { STAFF_PERMISSIONS } from "./types";
import { eventTitle } from "../event-title";

/*
 * In-memory data layer with sample data. Every exported function has the signature the
 * Supabase layer (replica-backend) will keep, and enforces the same access rules as the
 * RLS policies in replica/schema.sql, so screens behave the same when it's swapped.
 * Data resets when the dev server restarts.
 */

interface Store {
  profiles: Profile[];
  people: Person[];
  guardians: Guardian[];
  teams: Team[];
  roster: RosterMember[];
  events: TeamEvent[];
  rsvps: Rsvp[];
  outbox: OutboxEmail[];
}

const g = globalThis as unknown as { __teamAppStore?: Store };

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const now = () => new Date().toISOString();
const id = () => randomUUID();
const norm = (e: string) => e.trim().toLowerCase();

// ---------------------------------------------------------------------------
// access rules (mirror the SQL helper functions)
// ---------------------------------------------------------------------------

function myPeopleIds(uid: ID): ID[] {
  return db.guardians.filter((x) => x.userId === uid && x.status === "active").map((x) => x.personId);
}
function selfPersonId(uid: ID): ID | null {
  return db.guardians.find((x) => x.userId === uid && x.isSelf && x.status === "active")?.personId ?? null;
}
function isGuardian(uid: ID, personId: ID) {
  return myPeopleIds(uid).includes(personId);
}
function isTeamStaff(uid: ID, teamId: ID) {
  const team = db.teams.find((t) => t.id === teamId);
  if (team?.createdBy === uid) return true;
  const me = selfPersonId(uid);
  return db.roster.some((r) => r.teamId === teamId && r.personId === me && r.kind === "staff" && r.status === "active");
}
function hasTeamPerm(uid: ID, teamId: ID, perm: StaffPermission) {
  const team = db.teams.find((t) => t.id === teamId);
  if (team?.createdBy === uid) return true;
  const me = selfPersonId(uid);
  return db.roster.some(
    (r) => r.teamId === teamId && r.personId === me && r.kind === "staff" && r.status === "active" && r.permissions.includes(perm),
  );
}
function isTeamMember(uid: ID, teamId: ID) {
  if (isTeamStaff(uid, teamId)) return true;
  const mine = myPeopleIds(uid);
  return db.roster.some((r) => r.teamId === teamId && r.status === "active" && mine.includes(r.personId));
}

async function requireUser(): Promise<Profile> {
  const uid = await getSessionUserId();
  const user = uid ? db.profiles.find((p) => p.id === uid) : undefined;
  if (!user) throw new Error("Not signed in");
  return user;
}

// ---------------------------------------------------------------------------
// session and accounts
// ---------------------------------------------------------------------------

export async function getSessionUser(): Promise<Profile | null> {
  const uid = await getSessionUserId();
  return (uid && db.profiles.find((p) => p.id === uid)) || null;
}

/** Sample-data only: the accounts offered on the sign-in screen. */
export async function listDemoAccounts() {
  return DEMO_ACCOUNTS.map((a) => {
    const p = db.profiles.find((x) => x.id === a.id)!;
    return { id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, blurb: a.blurb };
  });
}

export async function signInAs(userId: ID) {
  if (!db.profiles.some((p) => p.id === userId)) throw new Error("Unknown account");
  await setSessionUserId(userId);
}

export async function signOut() {
  await clearSession();
}

export async function signUp(input: { firstName: string; lastName: string; email: string }): Promise<ActionResult<Profile>> {
  const email = norm(input.email);
  const fieldErrors: Record<string, string> = {};
  if (!input.firstName.trim()) fieldErrors.firstName = "Add your first name.";
  if (!input.lastName.trim()) fieldErrors.lastName = "Add your last name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "Enter an email like name@gmail.com.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const existing = db.profiles.find((p) => p.email === email);
  if (existing) {
    await setSessionUserId(existing.id);
    return { ok: true, data: existing };
  }
  const profile = createProfile(input.firstName.trim(), input.lastName.trim(), email);
  claimInvitesByEmail(profile);
  await setSessionUserId(profile.id);
  return { ok: true, data: profile };
}

function createProfile(firstName: string, lastName: string, email: string): Profile {
  const profile: Profile = { id: id(), firstName, lastName, email: norm(email), theme: "system", useTeamColors: true };
  db.profiles.push(profile);
  const person: Person = { id: id(), userId: profile.id, firstName, lastName };
  db.people.push(person);
  db.guardians.push({ id: id(), personId: person.id, userId: profile.id, invitedEmail: null, isPrimary: true, isSelf: true, status: "active" });
  return profile;
}

export async function updatePreferences(input: { theme?: Profile["theme"]; useTeamColors?: boolean }) {
  const user = await requireUser();
  if (input.theme) user.theme = input.theme;
  if (typeof input.useTeamColors === "boolean") user.useTeamColors = input.useTeamColors;
  return user;
}

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------

function toMyTeam(uid: ID, team: Team): MyTeam {
  const staff = isTeamStaff(uid, team.id);
  const mine = myPeopleIds(uid);
  const myPeople = db.roster
    .filter((r) => r.teamId === team.id && r.kind === "player" && r.status === "active" && mine.includes(r.personId))
    .map((r) => db.people.find((p) => p.id === r.personId)!)
    .filter(Boolean);
  const self = selfPersonId(uid);
  const role: MyTeam["myRole"] = staff ? "staff" : myPeople.some((p) => p.id === self) ? "player" : "guardian";
  return { ...team, myRole: role, myPeople, isStaff: staff };
}

export async function listMyTeams(): Promise<MyTeam[]> {
  const user = await requireUser();
  return db.teams
    .filter((t) => isTeamMember(user.id, t.id))
    .map((t) => toMyTeam(user.id, t))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeam(teamId: ID): Promise<MyTeam | null> {
  const user = await requireUser();
  const team = db.teams.find((t) => t.id === teamId);
  if (!team || !isTeamMember(user.id, teamId)) return null;
  return toMyTeam(user.id, team);
}

export async function createTeam(input: {
  name: string;
  sport: string;
  ageGroup?: string;
  location?: string;
  color: string;
  colorSecondary?: string | null;
  orgName?: string;
}): Promise<ActionResult<Team>> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "Give the team a name.";
  else if (name.length > 80) fieldErrors.name = "Keep the name under 80 characters.";
  if (!input.sport.trim()) fieldErrors.sport = "Pick a sport.";
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) fieldErrors.color = "Pick a colour.";
  if (input.colorSecondary && !/^#[0-9a-fA-F]{6}$/.test(input.colorSecondary)) fieldErrors.colorSecondary = "Pick a valid colour.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  const team: Team = {
    id: id(),
    name,
    sport: input.sport.trim(),
    ageGroup: input.ageGroup?.trim() || null,
    location: input.location?.trim() || null,
    color: input.color.toUpperCase(),
    colorSecondary: input.colorSecondary?.toUpperCase() || null,
    orgName: input.orgName?.trim() || null,
    joinCode: randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
    isPublic: true,
    rosterVisible: true,
    createdBy: user.id,
    createdAt: now(),
  };
  db.teams.push(team);
  db.roster.push({
    id: id(),
    teamId: team.id,
    personId: selfPersonId(user.id)!,
    kind: "staff",
    jersey: null,
    position: null,
    staffRole: "head_coach",
    permissions: [...STAFF_PERMISSIONS],
    status: "active",
    invitedEmail: null,
  });
  return { ok: true, data: team };
}

// ---------------------------------------------------------------------------
// roster and invites
// ---------------------------------------------------------------------------

export async function listRoster(teamId: ID): Promise<RosterRow[]> {
  const user = await requireUser();
  const team = db.teams.find((t) => t.id === teamId);
  if (!team || !isTeamMember(user.id, teamId)) return [];
  const staff = isTeamStaff(user.id, teamId);
  const mine = myPeopleIds(user.id);
  return db.roster
    .filter((r) => r.teamId === teamId && r.status !== "removed")
    .filter((r) => staff || mine.includes(r.personId) || (r.status === "active" && team.rosterVisible))
    .map((r) => {
      const person = db.people.find((p) => p.id === r.personId)!;
      const guardians = staff
        ? db.guardians
            .filter((gd) => gd.personId === person.id && !gd.isSelf)
            .map((gd) => {
              const p = gd.userId ? db.profiles.find((x) => x.id === gd.userId) : undefined;
              return { name: p ? `${p.firstName} ${p.lastName}` : gd.invitedEmail ?? "", email: p?.email ?? gd.invitedEmail, status: gd.status };
            })
        : [];
      return { ...r, person, guardians };
    })
    .sort((a, b) => (a.kind === b.kind ? (+(a.jersey ?? 999) - +(b.jersey ?? 999)) || a.person.lastName.localeCompare(b.person.lastName) : a.kind === "staff" ? 1 : -1));
}

export interface InviteRow {
  firstName: string;
  lastName: string;
  email: string;
  kind: "player" | "staff";
  jersey?: string;
  position?: string;
  staffRole?: StaffRole;
  permissions?: StaffPermission[];
  /** Player rows: is the email the player's own (an adult) or a parent's? */
  emailIsParent?: boolean;
}

export async function invitePeople(teamId: ID, rows: InviteRow[]): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "roster")) return { ok: false, error: "You don't have permission to change this roster." };
  const team = db.teams.find((t) => t.id === teamId)!;
  const inviter = `${user.firstName} ${user.lastName}`;

  const fieldErrors: Record<string, string> = {};
  rows.forEach((r, i) => {
    if (!r.firstName.trim()) fieldErrors[`${i}.firstName`] = "Add a first name.";
    if (!r.lastName.trim()) fieldErrors[`${i}.lastName`] = "Add a last name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm(r.email))) fieldErrors[`${i}.email`] = "Enter an email like name@gmail.com.";
  });
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  for (const r of rows) {
    const email = norm(r.email);
    const existing = db.profiles.find((p) => p.email === email);
    const isParentEmail = r.kind === "player" && r.emailIsParent !== false;

    // The person on the roster: the invitee themself, or a child of the invitee.
    let person: Person;
    if (!isParentEmail && existing) {
      person = db.people.find((p) => p.id === selfPersonId(existing.id))!;
    } else {
      person = { id: id(), userId: null, firstName: r.firstName.trim(), lastName: r.lastName.trim() };
      db.people.push(person);
    }
    if (db.roster.some((x) => x.teamId === teamId && x.personId === person.id && x.kind === r.kind && x.status !== "removed")) continue;

    // Who gets the invite: guardian row (invited until accepted).
    const alreadyGuardian = existing && db.guardians.some((gd) => gd.personId === person.id && gd.userId === existing.id);
    if (!alreadyGuardian) {
      db.guardians.push({
        id: id(),
        personId: person.id,
        userId: existing?.id ?? null,
        invitedEmail: email,
        isPrimary: true,
        isSelf: !isParentEmail,
        status: "invited",
      });
    }
    const rm: RosterMember = {
      id: id(),
      teamId,
      personId: person.id,
      kind: r.kind,
      jersey: r.kind === "player" ? r.jersey?.trim() || null : null,
      position: r.kind === "player" ? r.position?.trim() || null : null,
      staffRole: r.kind === "staff" ? r.staffRole ?? "assistant_coach" : null,
      permissions: r.kind === "staff" ? r.permissions ?? ["schedule_events", "scoring"] : [],
      status: "invited",
      invitedEmail: email,
    };
    db.roster.push(rm);

    const token = sign({ k: "invite", r: rm.id, e: email }, 60 * 60 * 24 * 30);
    const who = r.kind === "staff" ? "you" : isParentEmail ? person.firstName : "you";
    queueEmail({
      to: email,
      subject: `${inviter} added ${who === "you" ? "you" : who} to ${team.name}`,
      text: `${inviter} added ${who} to ${team.name}${r.kind === "staff" ? " as staff" : ""}. Join to see the schedule, answer for games and practices, and chat with the team.`,
      links: [{ label: "Join the team", href: `${APP_URL}/invite/${token}` }],
    });
  }
  return { ok: true, data: { count: rows.length } };
}

export async function getInvite(token: string) {
  const data = verify<{ k: string; r: string; e: string }>(token);
  if (!data || data.k !== "invite") return null;
  const rm = db.roster.find((x) => x.id === data.r);
  if (!rm) return null;
  const team = db.teams.find((t) => t.id === rm.teamId)!;
  const person = db.people.find((p) => p.id === rm.personId)!;
  const existing = db.profiles.find((p) => p.email === data.e);
  const gd = db.guardians.find((x) => x.personId === person.id && (x.invitedEmail === data.e || x.userId === existing?.id));
  return {
    email: data.e,
    team: { id: team.id, name: team.name, color: team.color, colorSecondary: team.colorSecondary },
    person: { firstName: person.firstName, lastName: person.lastName },
    kind: rm.kind,
    forChild: gd ? !gd.isSelf : true,
    accepted: rm.status === "active",
    hasAccount: !!existing,
  };
}

export async function acceptInvite(
  token: string,
  profile?: { firstName: string; lastName: string },
): Promise<ActionResult<{ teamId: ID }>> {
  const data = verify<{ k: string; r: string; e: string }>(token);
  if (!data || data.k !== "invite") return { ok: false, error: "This invite link has expired. Ask the coach to send a new one." };
  const rm = db.roster.find((x) => x.id === data.r);
  if (!rm) return { ok: false, error: "This invite was cancelled by the team." };

  let user = db.profiles.find((p) => p.email === data.e);
  if (!user) {
    if (!profile?.firstName.trim() || !profile.lastName.trim()) return { ok: false, error: "Add your name to join." };
    user = createProfile(profile.firstName.trim(), profile.lastName.trim(), data.e);
  }
  claimInvitesByEmail(user);
  await setSessionUserId(user.id);
  return { ok: true, data: { teamId: rm.teamId } };
}

/** Activate every pending invite sent to this email (both guardian and roster rows). */
function claimInvitesByEmail(user: Profile) {
  for (const gd of db.guardians.filter((x) => x.invitedEmail === user.email && x.status === "invited")) {
    if (gd.isSelf) {
      // Invite was for the invitee as an adult player or staff: merge into their own person record.
      const self = selfPersonId(user.id);
      if (self && self !== gd.personId) {
        db.roster.filter((r) => r.personId === gd.personId).forEach((r) => (r.personId = self));
        db.guardians = db.guardians.filter((x) => x !== gd);
        continue;
      }
    }
    gd.userId = user.id;
    gd.status = "active";
  }
  const mine = myPeopleIds(user.id);
  db.roster.filter((r) => r.status === "invited" && mine.includes(r.personId)).forEach((r) => (r.status = "active"));
}

// ---------------------------------------------------------------------------
// schedule
// ---------------------------------------------------------------------------

function withMine(uid: ID, e: TeamEvent): EventWithMine {
  const team = db.teams.find((t) => t.id === e.teamId)!;
  const mine = myPeopleIds(uid);
  const people = db.roster
    .filter((r) => r.teamId === e.teamId && r.kind === "player" && r.status === "active" && mine.includes(r.personId))
    .map((r) => db.people.find((p) => p.id === r.personId)!);
  return {
    ...e,
    team: { id: team.id, name: team.name, color: team.color, colorSecondary: team.colorSecondary },
    mine: people.map((person) => {
      const r = db.rsvps.find((x) => x.eventId === e.id && x.personId === person.id);
      return { person, response: r?.response ?? null, note: r?.note ?? null };
    }),
  };
}

export async function listEvents(teamId: ID, opts: { includePast?: boolean } = {}): Promise<EventWithMine[]> {
  const user = await requireUser();
  if (!isTeamMember(user.id, teamId)) return [];
  const cutoff = Date.now() - 6 * 3600 * 1000;
  return db.events
    .filter((e) => e.teamId === teamId && (opts.includePast || Date.parse(e.endAt) >= cutoff))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((e) => withMine(user.id, e));
}

export async function listPastEvents(teamId: ID, limit = 10): Promise<EventWithMine[]> {
  const user = await requireUser();
  if (!isTeamMember(user.id, teamId)) return [];
  const cutoff = Date.now() - 6 * 3600 * 1000;
  return db.events
    .filter((e) => e.teamId === teamId && Date.parse(e.endAt) < cutoff)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, limit)
    .map((e) => withMine(user.id, e));
}

export async function listUpcomingForMe(limit = 20): Promise<EventWithMine[]> {
  const user = await requireUser();
  const cutoff = Date.now() - 2 * 3600 * 1000;
  return db.events
    .filter((e) => isTeamMember(user.id, e.teamId) && Date.parse(e.endAt) >= cutoff)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, limit)
    .map((e) => withMine(user.id, e));
}

export async function listPendingRsvps(): Promise<EventWithMine[]> {
  const all = await listUpcomingForMe(200);
  return all.filter((e) => e.status === "active" && e.mine.some((m) => m.response === null));
}

export async function getEvent(eventId: ID): Promise<EventWithMine | null> {
  const user = await requireUser();
  const e = db.events.find((x) => x.id === eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  return withMine(user.id, e);
}

export interface EventInput {
  type: EventType;
  title?: string;
  date: string; // local YYYY-MM-DD in tz
  startTime: string; // HH:MM
  endTime: string;
  tz?: string;
  locationText?: string;
  opponent?: string;
  homeAway?: "home" | "away" | "neutral";
  notes?: string;
  notify: boolean;
}

export async function createEvent(teamId: ID, input: EventInput): Promise<ActionResult<TeamEvent>> {
  const user = await requireUser();
  const perm = input.type === "game" ? "schedule_games" : "schedule_events";
  if (!hasTeamPerm(user.id, teamId, perm)) return { ok: false, error: "You don't have permission to add this to the schedule." };
  const tz = input.tz || DEFAULT_TZ;
  const fieldErrors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fieldErrors.date = "Pick a date.";
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) fieldErrors.startTime = "Pick a start time.";
  if (!/^\d{2}:\d{2}$/.test(input.endTime)) fieldErrors.endTime = "Pick an end time.";
  if (input.type === "game" && !input.opponent?.trim()) fieldErrors.opponent = "Add who you're playing.";
  if (input.type === "event" && !input.title?.trim()) fieldErrors.title = "Give the event a name, like Team photo day.";
  let startAt = "", endAt = "";
  if (!fieldErrors.date && !fieldErrors.startTime && !fieldErrors.endTime) {
    startAt = zonedToUtc(input.date, input.startTime, tz);
    endAt = zonedToUtc(input.date, input.endTime, tz);
    if (endAt <= startAt) fieldErrors.endTime = "End time needs to be after the start.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  const e: TeamEvent = {
    id: id(),
    teamId,
    type: input.type,
    title: input.title?.trim() || null,
    startAt,
    endAt,
    tz,
    locationText: input.locationText?.trim() || null,
    opponent: input.type === "game" ? input.opponent!.trim() : null,
    homeAway: input.type === "game" ? input.homeAway ?? "home" : null,
    notes: input.notes?.trim() || null,
    status: "active",
    statusReason: null,
    createdBy: user.id,
  };
  db.events.push(e);
  if (input.notify) notifyEvent(e, "new");
  return { ok: true, data: e };
}

export async function setEventStatus(
  eventId: ID,
  status: TeamEvent["status"],
  reason?: string,
  notify = true,
): Promise<ActionResult<TeamEvent>> {
  const user = await requireUser();
  const e = db.events.find((x) => x.id === eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  const perm = e.type === "game" ? "schedule_games" : "schedule_events";
  if (!hasTeamPerm(user.id, e.teamId, perm)) return { ok: false, error: "You don't have permission to change this event." };
  e.status = status;
  e.statusReason = status === "active" ? null : reason?.trim() || null;
  if (notify) notifyEvent(e, status === "active" ? "reinstated" : status);
  return { ok: true, data: e };
}


// ---------------------------------------------------------------------------
// RSVPs
// ---------------------------------------------------------------------------

export async function setRsvp(eventId: ID, personId: ID, response: RsvpResponse, note?: string | null): Promise<ActionResult<Rsvp>> {
  const user = await requireUser();
  return writeRsvp(user.id, eventId, personId, response, note);
}

function writeRsvp(uid: ID, eventId: ID, personId: ID, response: RsvpResponse, note?: string | null): ActionResult<Rsvp> {
  const e = db.events.find((x) => x.id === eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  if (!(isGuardian(uid, personId) || isTeamStaff(uid, e.teamId))) return { ok: false, error: "You can only answer for your own family." };
  if (!db.roster.some((r) => r.teamId === e.teamId && r.personId === personId && r.status === "active"))
    return { ok: false, error: "This player isn't on the team." };
  if (e.status === "cancelled") return { ok: false, error: "This event was cancelled." };
  if (note && note.length > 500) return { ok: false, error: "Keep the note under 500 characters." };
  let r = db.rsvps.find((x) => x.eventId === eventId && x.personId === personId);
  if (r) {
    r.response = response;
    if (note !== undefined) r.note = note?.trim() || null;
    r.respondedBy = uid;
    r.updatedAt = now();
  } else {
    r = { id: id(), eventId, personId, response, note: note?.trim() || null, respondedBy: uid, updatedAt: now() };
    db.rsvps.push(r);
  }
  return { ok: true, data: r };
}

export async function getAvailability(eventId: ID): Promise<Availability | null> {
  const user = await requireUser();
  const e = db.events.find((x) => x.id === eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  const staff = isTeamStaff(user.id, e.teamId);
  const mine = myPeopleIds(user.id);
  const rows = db.roster
    .filter((r) => r.teamId === e.teamId && r.kind === "player" && r.status === "active")
    .map((r) => {
      const person = db.people.find((p) => p.id === r.personId)!;
      const rsvp = db.rsvps.find((x) => x.eventId === e.id && x.personId === person.id);
      return {
        person,
        jersey: r.jersey,
        response: rsvp?.response ?? null,
        note: staff || mine.includes(person.id) ? rsvp?.note ?? null : null,
      };
    })
    .sort((a, b) => a.person.firstName.localeCompare(b.person.firstName));
  const counts = { going: 0, maybe: 0, not_going: 0, none: 0 } as Availability["counts"];
  rows.forEach((r) => counts[r.response ?? "none"]++);
  return { counts, rows, canSeeNotes: staff };
}

/** One-tap RSVP from an email link, no sign-in needed. */
export async function rsvpFromLink(token: string): Promise<ActionResult<{ event: TeamEvent; person: Person; response: RsvpResponse; teamName: string }>> {
  const data = verify<{ k: string; e: string; p: string; u: string; r: RsvpResponse }>(token);
  if (!data || data.k !== "rsvp") return { ok: false, error: "This link has expired. Open the app to answer instead." };
  const res = writeRsvp(data.u, data.e, data.p, data.r);
  if (!res.ok) return res;
  const event = db.events.find((x) => x.id === data.e)!;
  const person = db.people.find((x) => x.id === data.p)!;
  return { ok: true, data: { event, person, response: data.r, teamName: db.teams.find((t) => t.id === event.teamId)!.name } };
}

export async function nudgeNonResponders(eventId: ID): Promise<ActionResult<{ sent: number }>> {
  const user = await requireUser();
  const e = db.events.find((x) => x.id === eventId);
  if (!e || !isTeamStaff(user.id, e.teamId)) return { ok: false, error: "Only staff can send reminders." };
  const sent = notifyEvent(e, "nudge");
  return { ok: true, data: { sent } };
}

// ---------------------------------------------------------------------------
// notifications (outbox; real layer sends through Resend + web push)
// ---------------------------------------------------------------------------

function queueEmail(m: Omit<OutboxEmail, "id" | "createdAt">) {
  db.outbox.unshift({ ...m, id: id(), createdAt: now() });
}

function notifyEvent(e: TeamEvent, kind: "new" | "postponed" | "cancelled" | "reinstated" | "nudge"): number {
  const team = db.teams.find((t) => t.id === e.teamId)!;
  const players = db.roster.filter((r) => r.teamId === e.teamId && r.kind === "player" && r.status === "active");
  const byUser = new Map<ID, Person[]>();
  for (const r of players) {
    if (kind === "nudge" && db.rsvps.some((x) => x.eventId === e.id && x.personId === r.personId)) continue;
    for (const gd of db.guardians.filter((x) => x.personId === r.personId && x.status === "active" && x.userId)) {
      const list = byUser.get(gd.userId!) ?? [];
      list.push(db.people.find((p) => p.id === r.personId)!);
      byUser.set(gd.userId!, list);
    }
  }
  const title = eventTitle(e);
  const when = `${formatLongDate(e.startAt, e.tz)}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}`;
  const subject = {
    new: `New ${e.type === "game" ? "game" : e.type}: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    postponed: `Postponed: ${title}`,
    cancelled: `Cancelled: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    reinstated: `Back on: ${title}`,
    nudge: `Can you make it? ${title} · ${formatLongDate(e.startAt, e.tz)}`,
  }[kind];
  for (const [uid, people] of byUser) {
    const u = db.profiles.find((p) => p.id === uid);
    if (!u) continue;
    const links: OutboxEmail["links"] = [];
    if (kind !== "cancelled") {
      for (const p of people) {
        for (const [r, label] of [["going", "Going"], ["maybe", "Maybe"], ["not_going", "Can't make it"]] as const) {
          const t = sign({ k: "rsvp", e: e.id, p: p.id, u: uid, r }, 60 * 60 * 24 * 21);
          links.push({ label: people.length > 1 ? `${p.firstName}: ${label}` : label, href: `${APP_URL}/r/${t}` });
        }
      }
    }
    links.push({ label: "Open in the app", href: `${APP_URL}/t/${team.id}/e/${e.id}` });
    queueEmail({
      to: u.email,
      subject: `${team.name} · ${subject}`,
      text:
        kind === "cancelled"
          ? `${title} on ${when} is cancelled.${e.statusReason ? ` Reason: ${e.statusReason}.` : ""}`
          : `${title}\n${when}${e.locationText ? `\n${e.locationText}` : ""}${e.notes ? `\n\n${e.notes}` : ""}\n\nLet the coach know if ${people.map((p) => p.firstName).join(" and ")} can make it:`,
      links,
    });
  }
  return byUser.size;
}

export async function listOutbox(): Promise<OutboxEmail[]> {
  return db.outbox.slice(0, 50);
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

const DEMO_ACCOUNTS = [
  { id: "u-priya", blurb: "Head coach, Kingston U12 Strikers" },
  { id: "u-anita", blurb: "Parent of Arjun (Strikers) and Diya (Comets)" },
  { id: "u-sam", blurb: "Parent of Maya (Strikers)" },
  { id: "u-marc", blurb: "Head coach, Ottawa U10 Comets" },
];

function seed(): Store {
  const s: Store = { profiles: [], people: [], guardians: [], teams: [], roster: [], events: [], rsvps: [], outbox: [] };
  const tz = DEFAULT_TZ;

  const profile = (pid: string, first: string, last: string, email: string) => {
    s.profiles.push({ id: pid, firstName: first, lastName: last, email, theme: "system", useTeamColors: true });
    const person = { id: `p-${pid}`, userId: pid, firstName: first, lastName: last };
    s.people.push(person);
    s.guardians.push({ id: `g-${pid}`, personId: person.id, userId: pid, invitedEmail: null, isPrimary: true, isSelf: true, status: "active" });
    return person;
  };
  const child = (cid: string, first: string, last: string, parentId: string | null, invitedEmail?: string) => {
    const person = { id: cid, userId: null, firstName: first, lastName: last };
    s.people.push(person);
    s.guardians.push({
      id: `g-${cid}`,
      personId: cid,
      userId: parentId,
      invitedEmail: invitedEmail ?? null,
      isPrimary: true,
      isSelf: false,
      status: parentId ? "active" : "invited",
    });
    return person;
  };

  const priya = profile("u-priya", "Priya", "Raman", "priya.coach@example.com");
  profile("u-anita", "Anita", "Nair", "anita.nair@example.com");
  profile("u-sam", "Sam", "Patel", "sam.patel@example.com");
  const marc = profile("u-marc", "Marc", "Tremblay", "marc.coach@example.com");
  // other families on the teams (no demo sign-in)
  const others: [string, string, string][] = [
    ["u-f1", "Grace", "Williams"], ["u-f2", "Harpreet", "Singh"], ["u-f3", "Julie", "Martin"],
    ["u-f4", "Kwame", "Brown"], ["u-f5", "Fiona", "Roy"], ["u-f6", "Rami", "Haddad"],
    ["u-f7", "Mei", "Lin"], ["u-f8", "Dan", "Kowalski"],
  ];
  others.forEach(([pid, f, l]) => profile(pid, f, l, `${f.toLowerCase()}.${l.toLowerCase()}@example.com`));

  const strikers: Team = {
    id: "t-strikers", name: "Kingston U12 Strikers", sport: "Soccer", ageGroup: "U12", location: "Kingston, ON",
    color: "#2D0A3E", colorSecondary: "#B8964A", orgName: null, joinCode: "KUS12A7Q", isPublic: true, rosterVisible: true,
    createdBy: "u-priya", createdAt: now(),
  };
  const comets: Team = {
    id: "t-comets", name: "Ottawa U10 Comets", sport: "Soccer", ageGroup: "U10", location: "Ottawa, ON",
    color: "#0B1F4B", colorSecondary: "#E4B23A", orgName: null, joinCode: "OTC10M3X", isPublic: true, rosterVisible: true,
    createdBy: "u-marc", createdAt: now(),
  };
  s.teams.push(strikers, comets);

  const staffRow = (teamId: string, personId: string, role: StaffRole): RosterMember => ({
    id: `r-${teamId}-${personId}`, teamId, personId, kind: "staff", jersey: null, position: null, staffRole: role,
    permissions: [...STAFF_PERMISSIONS], status: "active", invitedEmail: null,
  });
  const playerRow = (teamId: string, personId: string, jersey: string, position: string, status: RosterMember["status"] = "active"): RosterMember => ({
    id: `r-${teamId}-${personId}`, teamId, personId, kind: "player", jersey, position, staffRole: null, permissions: [],
    status, invitedEmail: null,
  });
  s.roster.push(staffRow("t-strikers", priya.id, "head_coach"), staffRow("t-comets", marc.id, "head_coach"));

  const kids: [string, string, string, string | null, string, string, string][] = [
    ["k-arjun", "Arjun", "Nair", "u-anita", "t-strikers", "11", "Midfield"],
    ["k-maya", "Maya", "Patel", "u-sam", "t-strikers", "7", "Forward"],
    ["k-noah", "Noah", "Williams", "u-f1", "t-strikers", "9", "Forward"],
    ["k-ava", "Ava", "Singh", "u-f2", "t-strikers", "3", "Defence"],
    ["k-zoe", "Zoe", "Martin", "u-f3", "t-strikers", "10", "Midfield"],
    ["k-ethan", "Ethan", "Brown", "u-f4", "t-strikers", "8", "Midfield"],
    ["k-isla", "Isla", "Roy", "u-f5", "t-strikers", "6", "Defence"],
    ["k-omar", "Omar", "Haddad", "u-f6", "t-strikers", "2", "Defence"],
    ["k-ben", "Ben", "Kowalski", "u-f8", "t-strikers", "1", "Goalkeeper"],
    ["k-diya", "Diya", "Nair", "u-anita", "t-comets", "5", "Forward"],
    ["k-lucas", "Lucas", "Lin", "u-f7", "t-comets", "4", "Defence"],
  ];
  for (const [cid, f, l, parent, team, jersey, pos] of kids) {
    if (!s.people.some((p) => p.id === cid)) child(cid, f, l, parent);
    s.roster.push(playerRow(team, cid, jersey, pos));
  }
  // one pending invite
  child("k-leo", "Leo", "Chen", null, "leo.chen.parent@example.com");
  s.roster.push({ ...playerRow("t-strikers", "k-leo", "4", "Forward", "invited"), invitedEmail: "leo.chen.parent@example.com" });

  // dates relative to today, in Toronto
  const today = utcToZoned(now(), tz).date;
  const addDays = (date: string, n: number) => new Date(Date.parse(date + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const dowOf = (date: string) => new Date(Date.parse(date + "T12:00:00Z")).getUTCDay();
  const next = (dow: number, weeks = 0) => {
    let d = today;
    while (dowOf(d) !== dow) d = addDays(d, 1);
    return addDays(d, weeks * 7);
  };
  const ev = (eid: string, teamId: string, type: EventType, date: string, start: string, end: string, extra: Partial<TeamEvent> = {}): TeamEvent => {
    const e: TeamEvent = {
      id: eid, teamId, type, title: null, startAt: zonedToUtc(date, start, tz), endAt: zonedToUtc(date, end, tz), tz,
      locationText: null, opponent: null, homeAway: null, notes: null, status: "active", statusReason: null,
      createdBy: teamId === "t-strikers" ? "u-priya" : "u-marc", ...extra,
    };
    s.events.push(e);
    return e;
  };

  const sat = next(6);
  const game1 = ev("e-s-g1", "t-strikers", "game", sat, "10:00", "11:30", {
    opponent: "Frontenac FC", homeAway: "home", locationText: "Invista Centre, Field 2",
    notes: "Arrive 30 minutes early for warm-up. White kits.",
  });
  for (let w = 0; w < 3; w++) {
    ev(`e-s-p-tue-${w}`, "t-strikers", "practice", next(2, w), "18:00", "19:15", { locationText: "Caraco Park" });
    ev(`e-s-p-thu-${w}`, "t-strikers", "practice", next(4, w), "18:00", "19:15", { locationText: "Caraco Park" });
  }
  ev("e-s-g2", "t-strikers", "game", next(6, 1), "13:00", "14:30", {
    opponent: "Ottawa Rangers", homeAway: "away", locationText: "Mooney's Bay Park, Ottawa",
    status: "cancelled", statusReason: "Field closed for frost",
  });
  ev("e-s-g3", "t-strikers", "game", next(6, 2), "10:00", "11:30", {
    opponent: "Belleville United", homeAway: "home", locationText: "Invista Centre, Field 1",
  });
  ev("e-s-past", "t-strikers", "game", addDays(sat, -7), "10:00", "11:30", {
    opponent: "Brockville Blaze", homeAway: "away", locationText: "Brockville Memorial Centre",
  });
  ev("e-s-photo", "t-strikers", "event", next(5, 1), "17:30", "18:30", {
    title: "Team photo day", locationText: "Invista Centre lobby", notes: "Full kit, hair tied back.",
  });

  const sun = next(0);
  ev("e-c-g1", "t-comets", "game", sun, "13:00", "14:00", {
    opponent: "Nepean Hotspurs", homeAway: "away", locationText: "Nepean Sportsplex, Field 4",
  });
  ev("e-c-p1", "t-comets", "practice", next(3), "17:30", "18:30", { locationText: "Lansdowne Park" });
  ev("e-c-p2", "t-comets", "practice", next(3, 1), "17:30", "18:30", { locationText: "Lansdowne Park" });

  const answers: [string, RsvpResponse, string, string | null][] = [
    ["k-maya", "going", "u-sam", null],
    ["k-noah", "going", "u-f1", null],
    ["k-ava", "maybe", "u-f2", "Depends on her ankle, will confirm Friday"],
    ["k-zoe", "going", "u-f3", null],
    ["k-ethan", "not_going", "u-f4", "Away at a family wedding"],
    ["k-isla", "going", "u-f5", null],
    ["k-ben", "going", "u-f8", "Might be 10 min late"],
  ];
  for (const [p, r, by, note] of answers)
    s.rsvps.push({ id: `rs-${game1.id}-${p}`, eventId: game1.id, personId: p, response: r, note, respondedBy: by, updatedAt: now() });
  s.rsvps.push({ id: "rs-p-maya", eventId: "e-s-p-tue-0", personId: "k-maya", response: "maybe", note: null, respondedBy: "u-sam", updatedAt: now() });

  return s;
}

// Initialised last so seed() can use every helper above. Survives dev hot-reloads via globalThis.
const db: Store = (g.__teamAppStore ??= seed());
