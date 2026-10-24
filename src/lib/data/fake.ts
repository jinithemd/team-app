import "server-only";
import { randomUUID } from "node:crypto";
import { getSessionUserId, setSessionUserId, clearSession } from "./session";
import { sign, verify } from "../tokens";
import { DEFAULT_TZ, utcToZoned, zonedToUtc, formatLongDate, formatTimeRange } from "../time";
import type {
  ActionResult,
  Availability,
  Club,
  ClubAdmin,
  ClubRole,
  EventType,
  EventWithMine,
  Hats,
  ID,
  MyClub,
  MyTeam,
  OutboxEmail,
  Person,
  Profile,
  RosterMember,
  RosterRow,
  Rsvp,
  RsvpResponse,
  Team,
  TeamEvent,
  TeamPermission,
  TeamRole,
} from "./types";
import { TEAM_PERMISSIONS, TEAM_ROLES, hatLabels, permissionsForRoles } from "./types";
import { eventTitle } from "../event-title";

/*
 * In-memory data layer with sample data. Every exported function has the signature the
 * Supabase layer (replica-backend) will keep, and enforces the same access rules as the
 * RLS policies in replica/schema.sql, so screens behave the same when it's swapped.
 * Data resets when the dev server restarts.
 */

interface Store {
  profiles: Profile[];
  clubs: Club[];
  clubAdmins: ClubAdmin[];
  teams: Team[];
  roster: RosterMember[];
  events: TeamEvent[];
  rsvps: Rsvp[];
  outbox: OutboxEmail[];
}

const g = globalThis as unknown as { __teamAppStoreV2?: Store };

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const now = () => new Date().toISOString();
const id = () => randomUUID();
const norm = (e: string) => e.trim().toLowerCase();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// access rules (mirror the SQL helper functions)
// ---------------------------------------------------------------------------

function teamById(teamId: ID) {
  return db.teams.find((t) => t.id === teamId);
}
function clubRoleFor(uid: ID, clubId: ID | null): ClubRole | null {
  if (!clubId) return null;
  return db.clubAdmins.find((a) => a.clubId === clubId && a.userId === uid)?.role ?? null;
}
function isClubAdminOfTeam(uid: ID, teamId: ID) {
  const r = clubRoleFor(uid, teamById(teamId)?.clubId ?? null);
  return r === "owner" || r === "admin";
}
function myRow(uid: ID, teamId: ID) {
  return db.roster.find((r) => r.teamId === teamId && r.userId === uid && (r.status === "active" || r.status === "inactive"));
}
function hasTeamPerm(uid: ID, teamId: ID, perm: TeamPermission) {
  const team = teamById(teamId);
  if (!team) return false;
  if (team.createdBy === uid || isClubAdminOfTeam(uid, teamId)) return true;
  if (perm === "payments" && clubRoleFor(uid, team.clubId) === "treasurer") return true;
  const row = myRow(uid, teamId);
  return !!row && row.status === "active" && row.permissions.includes(perm);
}
function isTeamStaff(uid: ID, teamId: ID) {
  const team = teamById(teamId);
  if (!team) return false;
  if (team.createdBy === uid || isClubAdminOfTeam(uid, teamId)) return true;
  const row = myRow(uid, teamId);
  return !!row && row.status === "active" && row.permissions.length > 0;
}
function isTeamMember(uid: ID, teamId: ID) {
  return isTeamStaff(uid, teamId) || !!myRow(uid, teamId);
}
function isActivePlayer(userId: ID, teamId: ID) {
  const row = myRow(userId, teamId);
  return !!row && row.status === "active" && row.isPlayer;
}

async function requireUser(): Promise<Profile> {
  const uid = await getSessionUserId();
  const user = uid ? db.profiles.find((p) => p.id === uid) : undefined;
  if (!user) throw new Error("Not signed in");
  return user;
}

function personFor(r: RosterMember): Person {
  const p = r.userId ? db.profiles.find((x) => x.id === r.userId) : undefined;
  if (p) return { id: p.id, firstName: p.firstName, lastName: p.lastName };
  return { id: r.id, firstName: r.invitedName?.firstName ?? "", lastName: r.invitedName?.lastName ?? "" };
}

function hatsFor(uid: ID, team: Team): Hats {
  const row = myRow(uid, team.id);
  return {
    isPlayer: !!row?.isPlayer,
    roles: row ? TEAM_ROLES.filter((r) => row.roles.includes(r)) : [],
    clubRole: clubRoleFor(uid, team.clubId),
    isCreator: team.createdBy === uid,
  };
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
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter an email like name@gmail.com.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const existing = db.profiles.find((p) => p.email === email);
  if (existing) {
    // Real build: this sends a sign-in link instead. Same account either way.
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
  return profile;
}

export async function updatePreferences(input: { theme?: Profile["theme"]; useTeamColors?: boolean }) {
  const user = await requireUser();
  if (input.theme) user.theme = input.theme;
  if (typeof input.useTeamColors === "boolean") user.useTeamColors = input.useTeamColors;
  return user;
}

/** Every hat I wear, for the Account screen. */
export async function listMyHats() {
  const user = await requireUser();
  const clubs = db.clubAdmins
    .filter((a) => a.userId === user.id)
    .map((a) => ({ clubId: a.clubId, name: db.clubs.find((c) => c.id === a.clubId)!.name, role: a.role }));
  const teams = db.teams
    .filter((t) => myRow(user.id, t.id) || t.createdBy === user.id)
    .map((t) => {
      const row = myRow(user.id, t.id);
      return { teamId: t.id, name: t.name, labels: hatLabels({ ...hatsFor(user.id, t), clubRole: null }, row?.jersey) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { clubs, teams };
}

// ---------------------------------------------------------------------------
// clubs
// ---------------------------------------------------------------------------

export async function listMyClubs(): Promise<MyClub[]> {
  const user = await requireUser();
  return db.clubAdmins
    .filter((a) => a.userId === user.id)
    .map((a) => {
      const c = db.clubs.find((x) => x.id === a.clubId)!;
      return { ...c, myRole: a.role, teamCount: db.teams.filter((t) => t.clubId === c.id).length };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 40) || "club"
  );
}

/** Creating a club makes you its owner. One transaction in the real build (service role). */
export async function createClub(input: { name: string; color: string; colorSecondary?: string | null }): Promise<ActionResult<Club>> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "Give the club a name.";
  else if (name.length > 80) fieldErrors.name = "Keep the name under 80 characters.";
  if (!HEX_RE.test(input.color)) fieldErrors.color = "Pick a colour.";
  if (input.colorSecondary && !HEX_RE.test(input.colorSecondary)) fieldErrors.colorSecondary = "Pick a valid colour.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  let slug = slugify(name);
  for (let n = 2; db.clubs.some((c) => c.slug === slug); n++) slug = `${slugify(name)}-${n}`;
  const club: Club = {
    id: id(),
    name,
    slug,
    color: input.color.toUpperCase(),
    colorSecondary: input.colorSecondary?.toUpperCase() || null,
    createdBy: user.id,
    createdAt: now(),
  };
  db.clubs.push(club);
  db.clubAdmins.push({ clubId: club.id, userId: user.id, role: "owner" });
  return { ok: true, data: club };
}

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------

function toMyTeam(uid: ID, team: Team): MyTeam {
  const row = myRow(uid, team.id);
  const club = team.clubId ? db.clubs.find((c) => c.id === team.clubId) : undefined;
  return {
    ...team,
    club: club ? { id: club.id, name: club.name, slug: club.slug } : null,
    me: row ? { id: row.id, isPlayer: row.isPlayer, roles: row.roles, jersey: row.jersey, position: row.position, permissions: row.permissions } : null,
    hats: hatsFor(uid, team),
    isStaff: isTeamStaff(uid, team.id),
    canManagePermissions: hasTeamPerm(uid, team.id, "manage_permissions"),
  };
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
  const team = teamById(teamId);
  if (!team || !isTeamMember(user.id, teamId)) return null;
  return toMyTeam(user.id, team);
}

export async function createTeam(input: {
  name: string;
  sport: string;
  level?: string;
  location?: string;
  color: string;
  colorSecondary?: string | null;
  clubId?: string | null;
}): Promise<ActionResult<Team>> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "Give the team a name.";
  else if (name.length > 80) fieldErrors.name = "Keep the name under 80 characters.";
  if (!input.sport.trim()) fieldErrors.sport = "Pick a sport.";
  if (!HEX_RE.test(input.color)) fieldErrors.color = "Pick a colour.";
  if (input.colorSecondary && !HEX_RE.test(input.colorSecondary)) fieldErrors.colorSecondary = "Pick a valid colour.";
  const clubId = input.clubId || null;
  if (clubId) {
    const role = clubRoleFor(user.id, clubId);
    if (role !== "owner" && role !== "admin") fieldErrors.clubId = "Only the club's owner or admins can add teams to it.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  const team: Team = {
    id: id(),
    clubId,
    name,
    sport: input.sport.trim(),
    level: input.level?.trim() || null,
    location: input.location?.trim() || null,
    color: input.color.toUpperCase(),
    colorSecondary: input.colorSecondary?.toUpperCase() || null,
    joinCode: randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
    isPublic: true,
    rosterVisible: true,
    createdBy: user.id,
    createdAt: now(),
  };
  db.teams.push(team);
  // You're on your own team from the start. The next step ("Your part on the team") sets
  // whether you play and which roles you hold. Until then you're its manager.
  db.roster.push({
    id: id(),
    teamId: team.id,
    userId: user.id,
    invitedEmail: null,
    invitedName: null,
    isPlayer: false,
    roles: ["manager"],
    jersey: null,
    position: null,
    permissions: [...TEAM_PERMISSIONS],
    status: "active",
  });
  return { ok: true, data: team };
}

/** "Your part on the team": do you play, your number and position, and which roles you hold. */
export async function setMyPart(
  teamId: ID,
  input: { isPlayer: boolean; jersey?: string; position?: string; roles: string[] },
): Promise<ActionResult<RosterMember>> {
  const user = await requireUser();
  const row = myRow(user.id, teamId);
  if (!row) return { ok: false, error: "You're not on this team." };
  const roles = TEAM_ROLES.filter((r) => input.roles.includes(r));
  const fieldErrors: Record<string, string> = {};
  const jersey = input.jersey?.trim() || null;
  if (!input.isPlayer && roles.length === 0) fieldErrors.roles = "Pick at least one: you play, or a role on the team.";
  if (input.isPlayer && jersey && !/^\d{1,3}$/.test(jersey)) fieldErrors.jersey = "Use up to 3 digits.";
  if (input.isPlayer && jersey && db.roster.some((r) => r.teamId === teamId && r.id !== row.id && r.status !== "removed" && r.isPlayer && r.jersey === jersey))
    fieldErrors.jersey = `Someone already wears ${jersey}.`;
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const rolesChanged = roles.join() !== TEAM_ROLES.filter((r) => row.roles.includes(r)).join();
  if (rolesChanged && !hasTeamPerm(user.id, teamId, "manage_permissions"))
    return { ok: false, error: "Only someone who manages permissions can change roles. Ask your captain." };

  row.isPlayer = input.isPlayer;
  row.jersey = input.isPlayer ? jersey : null;
  row.position = input.isPlayer ? input.position?.trim() || null : null;
  row.roles = roles;
  const team = teamById(teamId)!;
  // The creator keeps every permission whatever roles they pick; everyone else gets their roles' defaults.
  row.permissions = team.createdBy === user.id ? [...TEAM_PERMISSIONS] : permissionsForRoles(roles);
  return { ok: true, data: row };
}

// ---------------------------------------------------------------------------
// roster and invites
// ---------------------------------------------------------------------------

export async function listRoster(teamId: ID): Promise<RosterRow[]> {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !isTeamMember(user.id, teamId)) return [];
  const staff = isTeamStaff(user.id, teamId);
  return db.roster
    .filter((r) => r.teamId === teamId && r.status !== "removed")
    .filter((r) => staff || r.userId === user.id || (r.status === "active" && team.rosterVisible))
    .map((r) => {
      const p = r.userId ? db.profiles.find((x) => x.id === r.userId) : undefined;
      return {
        ...r,
        roles: TEAM_ROLES.filter((x) => r.roles.includes(x)),
        person: personFor(r),
        clubRole: r.userId ? clubRoleFor(r.userId, team.clubId) : null,
        email: staff ? p?.email ?? r.invitedEmail : null,
      };
    })
    .sort(
      (a, b) =>
        +b.isPlayer - +a.isPlayer ||
        (+(a.jersey ?? 999) - +(b.jersey ?? 999)) ||
        a.person.lastName.localeCompare(b.person.lastName),
    );
}

export interface InviteRow {
  firstName: string;
  lastName: string;
  email: string;
  jersey?: string;
  position?: string;
  isPlayer: boolean;
  roles?: string[];
}

export async function invitePeople(teamId: ID, rows: InviteRow[]): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "roster")) return { ok: false, error: "You don't have permission to change this roster." };
  const team = teamById(teamId)!;
  const canRoles = hasTeamPerm(user.id, teamId, "manage_permissions");
  const inviter = `${user.firstName} ${user.lastName}`;

  const fieldErrors: Record<string, string> = {};
  rows.forEach((r, i) => {
    if (!r.firstName.trim()) fieldErrors[`${i}.firstName`] = "Add a first name.";
    if (!r.lastName.trim()) fieldErrors[`${i}.lastName`] = "Add a last name.";
    if (!EMAIL_RE.test(norm(r.email))) fieldErrors[`${i}.email`] = "Enter an email like name@gmail.com.";
    if (!r.isPlayer && !(r.roles ?? []).length) fieldErrors[`${i}.roles`] = "Pick a role, or tick that they play.";
  });
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  if (!canRoles && rows.some((r) => (r.roles ?? []).length))
    return { ok: false, error: "Only someone who manages permissions can give out roles. Invite them as players for now." };

  let count = 0;
  for (const r of rows) {
    const email = norm(r.email);
    const existing = db.profiles.find((p) => p.email === email);
    const onTeam = db.roster.some(
      (x) => x.teamId === teamId && x.status !== "removed" && (x.invitedEmail === email || (existing && x.userId === existing.id)),
    );
    if (onTeam) continue;
    const roles = TEAM_ROLES.filter((x) => (r.roles ?? []).includes(x));
    const rm: RosterMember = {
      id: id(),
      teamId,
      userId: null,
      invitedEmail: email,
      invitedName: { firstName: r.firstName.trim(), lastName: r.lastName.trim() },
      isPlayer: r.isPlayer,
      roles,
      jersey: r.isPlayer ? r.jersey?.trim() || null : null,
      position: r.isPlayer ? r.position?.trim() || null : null,
      permissions: permissionsForRoles(roles),
      status: "invited",
    };
    db.roster.push(rm);
    count++;

    const token = sign({ k: "invite", r: rm.id, e: email }, 60 * 60 * 24 * 30);
    const as = hatLabels({ isPlayer: r.isPlayer, roles, clubRole: null, isCreator: false }).join(", ").toLowerCase();
    queueEmail({
      to: email,
      subject: `${inviter} added you to ${team.name}`,
      text: `${inviter} added you to ${team.name}${as ? ` (${as})` : ""}. Join to see the schedule, say if you're in for each game and training, and chat with the team.`,
      links: [{ label: "Join the team", href: `${APP_URL}/invite/${token}` }],
    });
  }
  return { ok: true, data: { count } };
}

export async function getInvite(token: string) {
  const data = verify<{ k: string; r: string; e: string }>(token);
  if (!data || data.k !== "invite") return null;
  const rm = db.roster.find((x) => x.id === data.r);
  if (!rm || rm.status === "removed") return null;
  const team = teamById(rm.teamId)!;
  const existing = db.profiles.find((p) => p.email === data.e);
  return {
    email: data.e,
    team: { id: team.id, name: team.name, color: team.color, colorSecondary: team.colorSecondary },
    person: personFor(rm),
    hats: hatLabels({ isPlayer: rm.isPlayer, roles: rm.roles, clubRole: null, isCreator: false }, rm.jersey),
    accepted: rm.status === "active",
    hasAccount: !!existing,
  };
}

export async function acceptInvite(
  token: string,
  profile?: { firstName: string; lastName: string },
): Promise<ActionResult<{ teamId: ID }>> {
  const data = verify<{ k: string; r: string; e: string }>(token);
  if (!data || data.k !== "invite") return { ok: false, error: "This invite link has expired. Ask your captain to send a new one." };
  const rm = db.roster.find((x) => x.id === data.r);
  if (!rm || rm.status === "removed") return { ok: false, error: "This invite was cancelled by the team." };

  let user = db.profiles.find((p) => p.email === data.e);
  if (!user) {
    if (!profile?.firstName.trim() || !profile.lastName.trim()) return { ok: false, error: "Add your name to join." };
    user = createProfile(profile.firstName.trim(), profile.lastName.trim(), data.e);
  }
  claimInvitesByEmail(user);
  await setSessionUserId(user.id);
  return { ok: true, data: { teamId: rm.teamId } };
}

/** Activate every pending invite sent to this email. One account, one row per team. */
function claimInvitesByEmail(user: Profile) {
  for (const r of db.roster.filter((x) => x.invitedEmail === user.email && x.status === "invited")) {
    if (myRow(user.id, r.teamId)) {
      r.status = "removed"; // already on that team: keep the row they have
      continue;
    }
    r.userId = user.id;
    r.status = "active";
  }
}

// ---------------------------------------------------------------------------
// schedule
// ---------------------------------------------------------------------------

function withMine(uid: ID, e: TeamEvent): EventWithMine {
  const team = teamById(e.teamId)!;
  const r = db.rsvps.find((x) => x.eventId === e.id && x.userId === uid);
  return {
    ...e,
    team: { id: team.id, name: team.name, color: team.color, colorSecondary: team.colorSecondary },
    mine: isActivePlayer(uid, e.teamId) ? { response: r?.response ?? null, note: r?.note ?? null } : null,
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
  return all.filter((e) => e.status === "active" && e.mine && e.mine.response === null);
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
  if (!hasTeamPerm(user.id, teamId, perm))
    return { ok: false, error: input.type === "game" ? "You don't have permission to add matches. Ask your manager." : "You don't have permission to add this to the schedule." };
  const tz = input.tz || DEFAULT_TZ;
  const fieldErrors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fieldErrors.date = "Pick a date.";
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) fieldErrors.startTime = "Pick a start time.";
  if (!/^\d{2}:\d{2}$/.test(input.endTime)) fieldErrors.endTime = "Pick an end time.";
  if (input.type === "game" && !input.opponent?.trim()) fieldErrors.opponent = "Add who you're playing.";
  if (input.type === "event" && !input.title?.trim()) fieldErrors.title = "Give the event a name, like End-of-season night.";
  let startAt = "",
    endAt = "";
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

export async function setEventStatus(eventId: ID, status: TeamEvent["status"], reason?: string, notify = true): Promise<ActionResult<TeamEvent>> {
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
// RSVPs: players answer for themselves; captains can fill in for someone who told them
// ---------------------------------------------------------------------------

export async function setRsvp(eventId: ID, userId: ID, response: RsvpResponse, note?: string | null): Promise<ActionResult<Rsvp>> {
  const user = await requireUser();
  return writeRsvp(user.id, eventId, userId, response, note);
}

function writeRsvp(uid: ID, eventId: ID, userId: ID, response: RsvpResponse, note?: string | null): ActionResult<Rsvp> {
  const e = db.events.find((x) => x.id === eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  if (uid !== userId && !isTeamStaff(uid, e.teamId)) return { ok: false, error: "You can only answer for yourself." };
  if (!isActivePlayer(userId, e.teamId)) return { ok: false, error: "Only players on the team can answer." };
  if (e.status === "cancelled") return { ok: false, error: "This event was cancelled." };
  if (note && note.length > 500) return { ok: false, error: "Keep the note under 500 characters." };
  let r = db.rsvps.find((x) => x.eventId === eventId && x.userId === userId);
  if (r) {
    r.response = response;
    if (note !== undefined) r.note = note?.trim() || null;
    r.respondedBy = uid;
    r.updatedAt = now();
  } else {
    r = { id: id(), eventId, userId, response, note: note?.trim() || null, respondedBy: uid, updatedAt: now() };
    db.rsvps.push(r);
  }
  return { ok: true, data: r };
}

export async function getAvailability(eventId: ID): Promise<Availability | null> {
  const user = await requireUser();
  const e = db.events.find((x) => x.id === eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  const staff = isTeamStaff(user.id, e.teamId);
  const rows = db.roster
    .filter((r) => r.teamId === e.teamId && r.isPlayer && r.status === "active" && r.userId)
    .map((r) => {
      const rsvp = db.rsvps.find((x) => x.eventId === e.id && x.userId === r.userId);
      return {
        person: personFor(r),
        jersey: r.jersey,
        response: rsvp?.response ?? null,
        note: staff || r.userId === user.id ? rsvp?.note ?? null : null,
      };
    })
    .sort((a, b) => a.person.firstName.localeCompare(b.person.firstName));
  const counts = { going: 0, maybe: 0, not_going: 0, none: 0 } as Availability["counts"];
  rows.forEach((r) => counts[r.response ?? "none"]++);
  return { counts, rows, canSeeNotes: staff };
}

/** One-tap answer from an email link, no sign-in needed. The token names the player. */
export async function rsvpFromLink(token: string): Promise<ActionResult<{ event: TeamEvent; person: Person; response: RsvpResponse; teamName: string }>> {
  const data = verify<{ k: string; e: string; u: string; r: RsvpResponse }>(token);
  if (!data || data.k !== "rsvp") return { ok: false, error: "This link has expired. Open the app to answer instead." };
  const res = writeRsvp(data.u, data.e, data.u, data.r);
  if (!res.ok) return res;
  const event = db.events.find((x) => x.id === data.e)!;
  const p = db.profiles.find((x) => x.id === data.u)!;
  return {
    ok: true,
    data: { event, person: { id: p.id, firstName: p.firstName, lastName: p.lastName }, response: data.r, teamName: teamById(event.teamId)!.name },
  };
}

export async function nudgeNonResponders(eventId: ID): Promise<ActionResult<{ sent: number }>> {
  const user = await requireUser();
  const e = db.events.find((x) => x.id === eventId);
  if (!e || !isTeamStaff(user.id, e.teamId)) return { ok: false, error: "Only captains and managers can send reminders." };
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
  const team = teamById(e.teamId)!;
  const players = db.roster.filter((r) => r.teamId === e.teamId && r.isPlayer && r.status === "active" && r.userId);
  const title = eventTitle(e);
  const when = `${formatLongDate(e.startAt, e.tz)}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}`;
  const noun = e.type === "game" ? "match" : e.type === "practice" ? "training" : "event";
  const subject = {
    new: `New ${noun}: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    postponed: `Postponed: ${title}`,
    cancelled: `Cancelled: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    reinstated: `Back on: ${title}`,
    nudge: `Are you in? ${title} · ${formatLongDate(e.startAt, e.tz)}`,
  }[kind];
  let sent = 0;
  for (const r of players) {
    if (kind === "nudge" && db.rsvps.some((x) => x.eventId === e.id && x.userId === r.userId)) continue;
    const u = db.profiles.find((p) => p.id === r.userId);
    if (!u) continue;
    const links: OutboxEmail["links"] = [];
    if (kind !== "cancelled") {
      for (const [resp, label] of [["going", "Going"], ["maybe", "Maybe"], ["not_going", "Can't make it"]] as const) {
        const t = sign({ k: "rsvp", e: e.id, u: u.id, r: resp }, 60 * 60 * 24 * 21);
        links.push({ label, href: `${APP_URL}/r/${t}` });
      }
    }
    links.push({ label: "Open in the app", href: `${APP_URL}/t/${team.id}/e/${e.id}` });
    queueEmail({
      to: u.email,
      subject: `${team.name} · ${subject}`,
      text:
        kind === "cancelled"
          ? `${title} on ${when} is cancelled.${e.statusReason ? ` Reason: ${e.statusReason}.` : ""}`
          : `${title}\n${when}${e.locationText ? `\n${e.locationText}` : ""}${e.notes ? `\n\n${e.notes}` : ""}\n\nAre you in?`,
      links,
    });
    sent++;
  }
  return sent;
}

export async function listOutbox(): Promise<OutboxEmail[]> {
  return db.outbox.slice(0, 50);
}

// ---------------------------------------------------------------------------
// seed: adult teams, one club, and people wearing several hats
// ---------------------------------------------------------------------------

const DEMO_ACCOUNTS = [
  { id: "u-dan", blurb: "Club owner, and plays for, captains and manages the First Team" },
  { id: "u-priya", blurb: "Plays for and captains Kingston Strikers" },
  { id: "u-rahul", blurb: "Player on two teams: Strikers and Limestone City Reserves" },
  { id: "u-marcus", blurb: "Plays for and captains Limestone City Reserves" },
];

function seed(): Store {
  const s: Store = { profiles: [], clubs: [], clubAdmins: [], teams: [], roster: [], events: [], rsvps: [], outbox: [] };
  const tz = DEFAULT_TZ;

  const people: [string, string, string][] = [
    ["u-dan", "Dan", "Kowalski"], ["u-priya", "Priya", "Raman"], ["u-rahul", "Rahul", "Menon"], ["u-marcus", "Marcus", "Lee"],
    ["u-sam", "Sam", "Okafor"], ["u-jordan", "Jordan", "Blake"], ["u-chris", "Chris", "Wong"], ["u-tom", "Tom", "Reyes"],
    ["u-ade", "Ade", "Bello"], ["u-leo", "Leo", "Grant"], ["u-femi", "Femi", "Ade"], ["u-aisha", "Aisha", "Shah"],
    ["u-kofi", "Kofi", "Mensah"], ["u-dev", "Dev", "Kapoor"], ["u-owen", "Owen", "Park"],
  ];
  for (const [pid, f, l] of people)
    s.profiles.push({ id: pid, firstName: f, lastName: l, email: `${f.toLowerCase()}.${l.toLowerCase()}@example.com`, theme: "system", useTeamColors: true });

  s.clubs.push({ id: "c-lcfc", name: "Limestone City FC", slug: "limestone-city", color: "#0F5C3A", colorSecondary: "#F2C14E", createdBy: "u-dan", createdAt: now() });
  s.clubAdmins.push({ clubId: "c-lcfc", userId: "u-dan", role: "owner" });

  const team = (tid: string, name: string, clubId: string | null, level: string, color: string, color2: string, by: string, code: string): Team => {
    const t: Team = {
      id: tid, clubId, name, sport: "Soccer", level, location: "Kingston, ON", color, colorSecondary: color2,
      joinCode: code, isPublic: true, rosterVisible: true, createdBy: by, createdAt: now(),
    };
    s.teams.push(t);
    return t;
  };
  team("t-strikers", "Kingston Strikers", null, "Sunday league", "#2D0A3E", "#B8964A", "u-priya", "KSTR7A2Q");
  team("t-first", "Limestone City First Team", "c-lcfc", "Division 1", "#0F5C3A", "#F2C14E", "u-dan", "LCFT9K3M");
  team("t-reserves", "Limestone City Reserves", "c-lcfc", "Division 2", "#0F5C3A", "#F2C14E", "u-dan", "LCRS4P8X");

  const member = (teamId: string, userId: string, jersey: string | null, position: string | null, roles: TeamRole[] = [], allPerms = false): void => {
    s.roster.push({
      id: `r-${teamId}-${userId}`, teamId, userId, invitedEmail: null, invitedName: null,
      isPlayer: jersey !== null, roles, jersey, position,
      permissions: allPerms ? [...TEAM_PERMISSIONS] : permissionsForRoles(roles), status: "active",
    });
  };
  // Strikers: Priya started it, plays #4 and captains.
  member("t-strikers", "u-priya", "4", "Defence", ["captain"], true);
  member("t-strikers", "u-rahul", "10", "Midfield");
  member("t-strikers", "u-sam", "1", "Goalkeeper");
  member("t-strikers", "u-jordan", "7", "Forward");
  member("t-strikers", "u-chris", "22", "Midfield");
  member("t-strikers", "u-tom", "9", "Forward");
  member("t-strikers", "u-ade", "15", "Defence");
  s.roster.push({
    id: "r-t-strikers-ben", teamId: "t-strikers", userId: null, invitedEmail: "ben.hart@example.com",
    invitedName: { firstName: "Ben", lastName: "Hart" }, isPlayer: true, roles: [], jersey: "18", position: "Defence",
    permissions: [], status: "invited",
  });
  // First Team: Dan owns the club, and plays #9, captains and manages here.
  member("t-first", "u-dan", "9", "Forward", ["captain", "manager"], true);
  member("t-first", "u-kofi", "5", "Defence", ["vice_captain"]);
  member("t-first", "u-dev", "11", "Midfield");
  member("t-first", "u-owen", "8", "Midfield");
  // Reserves: Marcus plays #2 and captains. Rahul plays here too.
  member("t-reserves", "u-marcus", "2", "Defence", ["captain"]);
  member("t-reserves", "u-rahul", "14", "Midfield");
  member("t-reserves", "u-leo", "3", "Defence");
  member("t-reserves", "u-femi", "19", "Forward");
  member("t-reserves", "u-aisha", "12", "Midfield", ["treasurer"]);

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
      createdBy: s.teams.find((t) => t.id === teamId)!.createdBy, ...extra,
    };
    s.events.push(e);
    return e;
  };

  const sat = next(6);
  const game1 = ev("e-s-g1", "t-strikers", "game", sat, "10:00", "11:30", {
    opponent: "Frontenac FC", homeAway: "home", locationText: "Invista Centre, Field 2",
    notes: "Meet 9:30 for warm-up. Purple kit.",
  });
  for (let w = 0; w < 3; w++) {
    ev(`e-s-p-tue-${w}`, "t-strikers", "practice", next(2, w), "18:00", "19:15", { locationText: "Caraco Park" });
    ev(`e-s-p-thu-${w}`, "t-strikers", "practice", next(4, w), "18:00", "19:15", { locationText: "Caraco Park" });
  }
  ev("e-s-g2", "t-strikers", "game", next(6, 1), "10:00", "11:30", {
    opponent: "Ottawa Rangers", homeAway: "away", locationText: "Mooney's Bay Park, Ottawa",
    status: "cancelled", statusReason: "Field closed for frost",
  });
  ev("e-s-g3", "t-strikers", "game", next(6, 2), "10:00", "11:30", {
    opponent: "Belleville United", homeAway: "home", locationText: "Invista Centre, Field 1",
  });
  ev("e-s-past", "t-strikers", "game", addDays(sat, -7), "10:00", "11:30", {
    opponent: "Brockville Blaze", homeAway: "home", locationText: "Caraco Park",
  });
  ev("e-s-social", "t-strikers", "event", next(6, 3), "19:00", "22:00", {
    title: "End-of-season night", locationText: "The clubhouse", notes: "Partners welcome.",
  });

  ev("e-r-g1", "t-reserves", "game", next(0), "13:00", "14:45", {
    opponent: "Napanee Rovers", homeAway: "away", locationText: "Napanee Fairgrounds", notes: "45 min drive. Sort out lifts in chat.",
  });
  ev("e-r-p1", "t-reserves", "practice", next(3), "19:30", "21:00", { locationText: "Club fieldhouse" });
  ev("e-r-g2", "t-reserves", "game", next(6, 1), "10:30", "12:15", { opponent: "Amherstview", homeAway: "home", locationText: "Club grounds, Pitch 1" });

  ev("e-f-g1", "t-first", "game", sat, "14:00", "15:45", { opponent: "Kingston Royals", homeAway: "home", locationText: "Club grounds, Pitch 1" });
  ev("e-f-p1", "t-first", "practice", next(2), "19:00", "20:30", { locationText: "Club fieldhouse" });

  const answers: [string, RsvpResponse, string | null][] = [
    ["u-priya", "going", null],
    ["u-sam", "going", null],
    ["u-jordan", "going", null],
    ["u-chris", "maybe", "Depends on work, will confirm Friday"],
    ["u-tom", "not_going", "Away at a wedding"],
    ["u-ade", "going", "Might be 10 min late"],
  ];
  for (const [u, r, note] of answers)
    s.rsvps.push({ id: `rs-${game1.id}-${u}`, eventId: game1.id, userId: u, response: r, note, respondedBy: u, updatedAt: now() });
  s.rsvps.push({ id: "rs-f-kofi", eventId: "e-f-g1", userId: "u-kofi", response: "going", note: null, respondedBy: "u-kofi", updatedAt: now() });

  return s;
}

// Initialised last so seed() can use every helper above. Survives dev hot-reloads via globalThis.
const db: Store = (g.__teamAppStoreV2 ??= seed());
