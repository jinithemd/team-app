import "server-only";
import { randomUUID } from "node:crypto";
import { newInviteToken } from "./invite-token";
import { setSessionUserId, clearSession, getSessionUserId } from "./session";
import { sign, verify } from "../tokens";
import { DEFAULT_TZ, formatLongDate, formatTimeRange, utcToZoned, zonedToUtc } from "../time";
import { eventTitle } from "../event-title";
import type {
  ActionResult,
  Availability,
  Club,
  Competition,
  EventType,
  EventWithMine,
  ID,
  MyClub,
  MyTeam,
  OutboxEmail,
  Person,
  PointsRules,
  Profile,
  RosterMember,
  RosterRow,
  Rsvp,
  RsvpResponse,
  Team,
  TeamEvent,
  TeamSettings,
  Venue,
} from "./types";
import { DEFAULT_POINTS_RULES, EVENT_TYPES, TEAM_PERMISSIONS, TEAM_ROLES, hatLabels, isFixture, permissionsForRoles } from "./types";
import {
  APP_URL,
  EMAIL_RE,
  HEX_RE,
  activePlayers,
  clubRoleFor,
  db,
  eventById,
  hasTeamPerm,
  hatsFor,
  isActivePlayer,
  isTeamMember,
  isTeamStaff,
  myRow,
  newId,
  norm,
  now,
  openSeason,
  personFor,
  profileById,
  queueEmail,
  requireUser,
  teamById,
  unavailableFor,
  unavailableKind,
} from "./store";
import { DEMO_ACCOUNTS } from "./seed";

/*
 * Core data functions: accounts, clubs, teams, roster, schedule and answers.
 * Feature modules (availability, attendance, matchday, carpools, dues, chat, club) sit
 * beside this file and use the same store and access rules.
 */

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

export function createProfile(firstName: string, lastName: string, email: string): Profile {
  const profile: Profile = { id: newId(), firstName, lastName, email: norm(email), theme: "system", useTeamColors: true };
  db.profiles.push(profile);
  return profile;
}

export async function updatePreferences(input: { theme?: Profile["theme"]; useTeamColors?: boolean }) {
  const user = await requireUser();
  if (input.theme) user.theme = input.theme;
  if (typeof input.useTeamColors === "boolean") user.useTeamColors = input.useTeamColors;
  return user;
}

export async function updateProfile(input: { firstName: string; lastName: string; phone: string }): Promise<ActionResult<Profile>> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  if (!input.firstName.trim()) fieldErrors.firstName = "Add your first name.";
  if (!input.lastName.trim()) fieldErrors.lastName = "Add your last name.";
  if (input.phone && !/^[\d\s()+-]{7,20}$/.test(input.phone)) fieldErrors.phone = "Enter a phone number like 613-555-0188.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  user.firstName = input.firstName.trim();
  user.lastName = input.lastName.trim();
  user.phone = input.phone.trim() || undefined;
  return { ok: true, data: user };
}

/** Every hat I wear, for the Account screen. */
export async function listMyHats() {
  const user = await requireUser();
  const clubs = db.clubAdmins
    .filter((a) => a.userId === user.id)
    .map((a) => ({ clubId: a.clubId, name: db.clubs.find((c) => c.id === a.clubId)!.name, slug: db.clubs.find((c) => c.id === a.clubId)!.slug, role: a.role }));
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
// clubs (creation; club pages live in club.ts)
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
    id: newId(),
    name,
    slug,
    color: input.color.toUpperCase(),
    colorSecondary: input.colorSecondary?.toUpperCase() || null,
    logo: null,
    blurb: null,
    joinOpen: true,
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

/** What the signed-in user can do on a team: one object so screens don't re-derive rules. */
export async function myPerms(teamId: ID) {
  const user = await requireUser();
  const p = (perm: (typeof TEAM_PERMISSIONS)[number]) => hasTeamPerm(user.id, teamId, perm);
  return {
    userId: user.id,
    staff: isTeamStaff(user.id, teamId),
    plays: isActivePlayer(user.id, teamId),
    games: p("schedule_games"),
    events: p("schedule_events"),
    roster: p("roster"),
    attendance: p("attendance"),
    scoring: p("scoring"),
    payments: p("payments"),
    messages: p("messages"),
    settings: p("edit_settings"),
    permissions: p("manage_permissions"),
  };
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
    id: newId(),
    clubId,
    name,
    sport: input.sport.trim(),
    level: input.level?.trim() || null,
    location: input.location?.trim() || null,
    color: input.color.toUpperCase(),
    colorSecondary: input.colorSecondary?.toUpperCase() || null,
    joinCode: randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
    inviteToken: newInviteToken(),
    isPublic: true,
    rosterVisible: true,
    createdBy: user.id,
    createdAt: now(),
    settings: { crest: null, pointsEnabled: false, pointsPublic: true, pointsRules: { ...DEFAULT_POINTS_RULES }, geoCheckinEnabled: false, membersCanPost: true },
  };
  db.teams.push(team);
  db.conversations.push({ id: newId(), teamId: team.id, kind: "team" }, { id: newId(), teamId: team.id, kind: "staff" }, { id: newId(), teamId: team.id, kind: "sponsors" });
  const today = utcToZoned(now(), DEFAULT_TZ).date;
  db.seasons.push({ id: newId(), teamId: team.id, name: seasonName(today), startsOn: today, endsOn: null, closedAt: null });
  // You're on your own team from the start. The next step ("Your part on the team") sets
  // whether you play and which roles you hold. Until then you're its manager.
  db.roster.push({
    id: newId(),
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

export function seasonName(date: string) {
  const [y, m] = date.split("-").map(Number);
  return m >= 4 && m <= 9 ? `Summer ${y}` : m >= 10 ? `Winter ${y}–${String(y + 1).slice(2)}` : `Winter ${y - 1}–${String(y).slice(2)}`;
}

export async function updateTeam(
  teamId: ID,
  input: {
    name: string;
    level?: string;
    location?: string;
    color: string;
    colorSecondary?: string | null;
    rosterVisible: boolean;
    membersCanPost: boolean;
    sponsorChat?: boolean;
    pointsEnabled: boolean;
    pointsPublic: boolean;
    geoCheckinEnabled: boolean;
    pointsRules: Partial<Record<keyof PointsRules, string>>;
    crest?: string | null; // data URL, "" to remove, undefined to keep
  },
): Promise<ActionResult<Team>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "edit_settings")) return { ok: false, error: "You don't have permission to change team settings." };
  const team = teamById(teamId)!;
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "Give the team a name.";
  if (!HEX_RE.test(input.color)) fieldErrors.color = "Pick a colour.";
  if (input.colorSecondary && !HEX_RE.test(input.colorSecondary)) fieldErrors.colorSecondary = "Pick a valid colour.";
  const rules: PointsRules = { ...team.settings.pointsRules };
  for (const k of Object.keys(DEFAULT_POINTS_RULES) as (keyof PointsRules)[]) {
    const v = input.pointsRules[k];
    if (v === undefined || v === "") continue;
    const n = Number(v);
    const [lo, hi] = k === "late_after_minutes" ? [1, 120] : k === "late_penalty" ? [-20, 0] : [0, 50];
    if (!Number.isInteger(n) || n < lo || n > hi) fieldErrors[`rule.${k}`] = `Use a whole number from ${lo} to ${hi}.`;
    else rules[k] = n;
  }
  if (input.crest && (!input.crest.startsWith("data:image/") || input.crest.length > 700_000)) fieldErrors.crest = "Use a PNG, JPG or SVG under 500 KB.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  team.name = name;
  team.level = input.level?.trim() || null;
  team.location = input.location?.trim() || null;
  team.color = input.color.toUpperCase();
  team.colorSecondary = input.colorSecondary?.toUpperCase() || null;
  team.rosterVisible = input.rosterVisible;
  const st: TeamSettings = team.settings;
  st.membersCanPost = input.membersCanPost;
  if (input.sponsorChat !== undefined) st.sponsorChat = input.sponsorChat;
  st.pointsEnabled = input.pointsEnabled;
  st.pointsPublic = input.pointsPublic;
  st.geoCheckinEnabled = input.geoCheckinEnabled;
  st.pointsRules = rules;
  if (input.crest !== undefined) st.crest = input.crest || null;
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
  const fieldErrors = checkPart(teamId, row.id, input.isPlayer, input.jersey, roles, "you play");
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const rolesChanged = roles.join() !== TEAM_ROLES.filter((r) => row.roles.includes(r)).join();
  if (rolesChanged && !hasTeamPerm(user.id, teamId, "manage_permissions"))
    return { ok: false, error: "Only someone who manages permissions can change roles. Ask your captain." };
  const team = teamById(teamId)!;
  applyPart(row, input.isPlayer, input.jersey, input.position, roles);
  // The creator keeps every permission whatever roles they pick; everyone else gets their roles' defaults.
  row.permissions = team.createdBy === user.id ? [...TEAM_PERMISSIONS] : rolesChanged ? permissionsForRoles(roles) : row.permissions;
  return { ok: true, data: row };
}

function checkPart(teamId: ID, rowId: ID, isPlayer: boolean, jerseyIn: string | undefined, roles: string[], who: string) {
  const fieldErrors: Record<string, string> = {};
  const jersey = jerseyIn?.trim() || null;
  if (!isPlayer && roles.length === 0) fieldErrors.roles = `Pick at least one: ${who}, or a role on the team.`;
  if (isPlayer && jersey && !/^\d{1,3}$/.test(jersey)) fieldErrors.jersey = "Use up to 3 digits.";
  if (isPlayer && jersey && db.roster.some((r) => r.teamId === teamId && r.id !== rowId && r.status !== "removed" && r.isPlayer && r.jersey === jersey))
    fieldErrors.jersey = `Someone already wears ${jersey}.`;
  return fieldErrors;
}
function applyPart(row: RosterMember, isPlayer: boolean, jersey: string | undefined, position: string | undefined, roles: RosterMember["roles"]) {
  row.isPlayer = isPlayer;
  row.jersey = isPlayer ? jersey?.trim() || null : null;
  row.position = isPlayer ? position?.trim() || null : null;
  row.roles = roles;
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
    .map((r) => toRosterRow(r, team, staff))
    .sort(
      (a, b) =>
        +b.isPlayer - +a.isPlayer ||
        +(a.status === "inactive") - +(b.status === "inactive") ||
        (+(a.jersey ?? 999) - +(b.jersey ?? 999)) ||
        a.person.lastName.localeCompare(b.person.lastName),
    );
}

function toRosterRow(r: RosterMember, team: Team, staff: boolean): RosterRow {
  const p = profileById(r.userId);
  return {
    ...r,
    roles: TEAM_ROLES.filter((x) => r.roles.includes(x)),
    person: personFor(r),
    clubRole: r.userId ? clubRoleFor(r.userId, team.clubId) : null,
    email: staff ? p?.email ?? r.invitedEmail : null,
  };
}

/** One roster row, for the edit-person screen. Only people who manage permissions can open it. */
export async function getMember(teamId: ID, memberId: ID): Promise<(RosterRow & { isCreator: boolean }) | null> {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !hasTeamPerm(user.id, teamId, "manage_permissions")) return null;
  const r = db.roster.find((x) => x.id === memberId && x.teamId === teamId && x.status !== "removed");
  if (!r) return null;
  return { ...toRosterRow(r, team, true), isCreator: !!r.userId && r.userId === team.createdBy };
}

/**
 * Change someone's part on the team: whether they play, their number, their roles and what
 * they can do. Any number of people can share a role (two managers, three coaches).
 */
export async function updateMember(
  teamId: ID,
  memberId: ID,
  input: { isPlayer: boolean; jersey?: string; position?: string; roles: string[]; permissions: string[] },
): Promise<ActionResult<RosterMember>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "manage_permissions")) return { ok: false, error: "Only someone who manages permissions can change roles." };
  const team = teamById(teamId)!;
  const row = db.roster.find((x) => x.id === memberId && x.teamId === teamId && x.status !== "removed");
  if (!row) return { ok: false, error: "That person isn't on the team any more." };
  const roles = TEAM_ROLES.filter((r) => input.roles.includes(r));
  const permissions = TEAM_PERMISSIONS.filter((p) => input.permissions.includes(p));
  const fieldErrors = checkPart(teamId, row.id, input.isPlayer, input.jersey, roles, "they play");
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  applyPart(row, input.isPlayer, input.jersey, input.position, roles);
  // The team can't lock itself out: whoever started it always keeps every permission.
  row.permissions = row.userId && row.userId === team.createdBy ? [...TEAM_PERMISSIONS] : permissions;
  return { ok: true, data: row };
}

/** Inactive keeps someone's history but stops reminders; removed takes them off the team. */
export async function setMemberStatus(teamId: ID, memberId: ID, status: "active" | "inactive" | "removed"): Promise<ActionResult<RosterMember>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "roster")) return { ok: false, error: "You don't have permission to change this roster." };
  const team = teamById(teamId)!;
  const row = db.roster.find((x) => x.id === memberId && x.teamId === teamId && x.status !== "removed");
  if (!row) return { ok: false, error: "That person isn't on the team any more." };
  if (row.userId === team.createdBy && status !== "active") return { ok: false, error: "The person who started the team can't be removed from it." };
  if (row.status === "invited" && status === "inactive") return { ok: false, error: "They haven't joined yet. Cancel the invite instead." };
  row.status = status;
  return { ok: true, data: row };
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
    const onTeam = db.roster.some((x) => x.teamId === teamId && x.status !== "removed" && (x.invitedEmail === email || (existing && x.userId === existing.id)));
    if (onTeam) continue;
    const roles = TEAM_ROLES.filter((x) => (r.roles ?? []).includes(x));
    const rm: RosterMember = {
      id: newId(),
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
    sendInvite(rm, team, inviter);
  }
  return { ok: true, data: { count } };
}

function sendInvite(rm: RosterMember, team: Team, inviter: string) {
  const token = sign({ k: "invite", r: rm.id, e: rm.invitedEmail }, 60 * 60 * 24 * 30);
  const as = hatLabels({ isPlayer: rm.isPlayer, roles: rm.roles, clubRole: null, isCreator: false }).join(", ").toLowerCase();
  queueEmail({
    to: rm.invitedEmail!,
    subject: `${inviter} added you to ${team.name}`,
    text: `${inviter} added you to ${team.name}${as ? ` (${as})` : ""}. Join to see the schedule, say if you're in for each game and training, and chat with the team.`,
    links: [{ label: "Join the team", href: `${APP_URL}/invite/${token}` }],
  });
}

export async function resendInvite(teamId: ID, memberId: ID): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "roster")) return { ok: false, error: "You don't have permission to change this roster." };
  const rm = db.roster.find((x) => x.id === memberId && x.teamId === teamId && x.status === "invited");
  if (!rm) return { ok: false, error: "They've already joined or the invite was cancelled." };
  sendInvite(rm, teamById(teamId)!, `${user.firstName} ${user.lastName}`);
  return { ok: true, data: undefined };
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

export async function acceptInvite(token: string, profile?: { firstName: string; lastName: string }): Promise<ActionResult<{ teamId: ID }>> {
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
export function claimInvitesByEmail(user: Profile) {
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
// venues
// ---------------------------------------------------------------------------

export async function listVenues(teamId: ID): Promise<Venue[]> {
  const user = await requireUser();
  if (!isTeamMember(user.id, teamId)) return [];
  return db.venues.filter((v) => v.teamId === teamId).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveVenue(
  teamId: ID,
  venueId: ID | null,
  input: { name: string; address?: string; lat?: string; lng?: string; radiusM?: string },
): Promise<ActionResult<Venue>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "schedule_events") && !hasTeamPerm(user.id, teamId, "edit_settings"))
    return { ok: false, error: "You don't have permission to change venues." };
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "Give the venue a name.";
  const lat = input.lat?.trim() ? Number(input.lat) : null;
  const lng = input.lng?.trim() ? Number(input.lng) : null;
  if ((lat === null) !== (lng === null)) fieldErrors.lat = "Add both latitude and longitude, or neither.";
  else if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) fieldErrors.lat = "Latitude is between -90 and 90.";
  else if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) fieldErrors.lng = "Longitude is between -180 and 180.";
  const radius = input.radiusM?.trim() ? Number(input.radiusM) : 150;
  if (!Number.isInteger(radius) || radius < 50 || radius > 1000) fieldErrors.radiusM = "Use 50 to 1000 metres.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  let v = venueId ? db.venues.find((x) => x.id === venueId && x.teamId === teamId) : undefined;
  if (!v) {
    v = { id: newId(), teamId, name, address: null, lat: null, lng: null, radiusM: 150 };
    db.venues.push(v);
  }
  Object.assign(v, { name, address: input.address?.trim() || null, lat, lng, radiusM: radius });
  db.events.filter((e) => e.venueId === v!.id).forEach((e) => (e.locationText = v!.name));
  return { ok: true, data: v };
}

// ---------------------------------------------------------------------------
// schedule
// ---------------------------------------------------------------------------

function withMine(uid: ID, e: TeamEvent): EventWithMine {
  const team = teamById(e.teamId)!;
  const r = db.rsvps.find((x) => x.eventId === e.id && x.userId === uid);
  const score = db.scores.find((s) => s.eventId === e.id);
  return {
    ...e,
    team: { id: team.id, name: team.name, color: team.color, colorSecondary: team.colorSecondary },
    venue: e.venueId ? db.venues.find((v) => v.id === e.venueId) ?? null : null,
    mine: isActivePlayer(uid, e.teamId)
      ? { response: r?.response ?? null, note: r?.note ?? null, unavailable: unavailableKind(uid, e.teamId, e.startAt, e.tz) }
      : null,
    score: score && score.status !== "not_started" ? { us: score.us, them: score.them, status: score.status } : null,
  };
}

/** My answer, or "can't go" if I've marked myself unavailable that day and haven't said otherwise. */
export function effectiveResponse(userId: ID, e: TeamEvent): RsvpResponse | null {
  const r = db.rsvps.find((x) => x.eventId === e.id && x.userId === userId);
  if (r) return r.response;
  return unavailableFor(userId, e.teamId, e.startAt, e.tz) ? "not_going" : null;
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
  return all.filter((e) => e.status === "active" && e.mine && e.mine.response === null && !e.mine.unavailable && Date.parse(e.startAt) > Date.now());
}

/** The most recent finished match I played in, for the home card. */
export async function getLastResultForMe(): Promise<EventWithMine | null> {
  const user = await requireUser();
  const past = db.events
    .filter((e) => isFixture(e.type) && isActivePlayer(user.id, e.teamId) && db.scores.some((s) => s.eventId === e.id && s.status === "final"))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  return past[0] ? withMine(user.id, past[0]) : null;
}

export async function getEvent(eventId: ID): Promise<EventWithMine | null> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  return withMine(user.id, e);
}

export interface EventInput {
  type: EventType;
  competition?: Competition | "";
  title?: string;
  date: string; // local YYYY-MM-DD in tz
  startTime: string; // HH:MM
  endTime: string;
  meetMinutes?: string; // "30" = meet 30 min before
  tz?: string;
  venueId?: string;
  locationText?: string;
  opponent?: string;
  homeAway?: "home" | "away" | "neutral";
  notes?: string;
  squadSize?: string;
  repeatWeeks?: string; // trainings: repeat weekly for N weeks
  sponsorVisible?: "auto" | "show" | "hide";
  notify: boolean;
}
const sponsorFlag = (v?: string) => (v === "show" ? true : v === "hide" ? false : null);

function validateEvent(teamId: ID, input: EventInput) {
  const tz = input.tz || DEFAULT_TZ;
  const fieldErrors: Record<string, string> = {};
  if (!EVENT_TYPES.includes(input.type)) fieldErrors.type = "Pick what kind of event this is.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fieldErrors.date = "Pick a date.";
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) fieldErrors.startTime = "Pick a start time.";
  if (!/^\d{2}:\d{2}$/.test(input.endTime)) fieldErrors.endTime = "Pick an end time.";
  if (input.type === "match" && !input.opponent?.trim()) fieldErrors.opponent = "Add who you're playing.";
  if ((input.type === "social" || input.type === "other" || input.type === "tournament") && !input.title?.trim())
    fieldErrors.title = input.type === "tournament" ? "Give the tournament a name." : "Give the event a name, like End-of-season night.";
  const squad = input.squadSize?.trim() ? Number(input.squadSize) : null;
  if (squad !== null && (!Number.isInteger(squad) || squad < 1 || squad > 60)) fieldErrors.squadSize = "Use a number from 1 to 60.";
  const meetMin = input.meetMinutes?.trim() ? Number(input.meetMinutes) : 0;
  if (!Number.isInteger(meetMin) || meetMin < 0 || meetMin > 180) fieldErrors.meetMinutes = "Use 0 to 180 minutes.";
  const weeks = input.repeatWeeks?.trim() ? Number(input.repeatWeeks) : 1;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 30) fieldErrors.repeatWeeks = "Repeat for 1 to 30 weeks.";
  const venue = input.venueId ? db.venues.find((v) => v.id === input.venueId && v.teamId === teamId) : undefined;
  if (input.venueId && !venue) fieldErrors.venueId = "That venue isn't on this team.";
  let startAt = "",
    endAt = "";
  if (!fieldErrors.date && !fieldErrors.startTime && !fieldErrors.endTime) {
    startAt = zonedToUtc(input.date, input.startTime, tz);
    endAt = zonedToUtc(input.date, input.endTime, tz);
    if (endAt <= startAt) fieldErrors.endTime = "End time needs to be after the start.";
  }
  return { tz, fieldErrors, startAt, endAt, squad, meetMin, weeks, venue };
}

export async function createEvent(teamId: ID, input: EventInput): Promise<ActionResult<TeamEvent>> {
  const user = await requireUser();
  const perm = isFixture(input.type) ? "schedule_games" : "schedule_events";
  if (!hasTeamPerm(user.id, teamId, perm))
    return { ok: false, error: isFixture(input.type) ? "You don't have permission to add matches. Ask your manager." : "You don't have permission to add this to the schedule." };
  const v = validateEvent(teamId, input);
  if (Object.keys(v.fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: v.fieldErrors };
  const seriesId = v.weeks > 1 ? newId() : null;
  const created: TeamEvent[] = [];
  for (let w = 0; w < v.weeks; w++) {
    const shift = (iso: string) => {
      // Shift by whole local days so 6 pm stays 6 pm across daylight saving changes.
      const { date, time } = utcToZoned(iso, v.tz);
      const d = new Date(Date.parse(date + "T12:00:00Z") + w * 7 * 86400000).toISOString().slice(0, 10);
      return zonedToUtc(d, time, v.tz);
    };
    const startAt = shift(v.startAt);
    const e: TeamEvent = {
      id: newId(),
      teamId,
      seasonId: openSeason(teamId)?.id ?? null,
      seriesId,
      type: input.type,
      competition: isFixture(input.type) && input.competition ? input.competition : null,
      title: input.title?.trim() || null,
      startAt,
      endAt: shift(v.endAt),
      meetAt: v.meetMin ? new Date(Date.parse(startAt) - v.meetMin * 60000).toISOString() : null,
      tz: v.tz,
      venueId: v.venue?.id ?? null,
      locationText: v.venue?.name ?? (input.locationText?.trim() || null),
      opponent: input.type === "match" ? input.opponent!.trim() : input.type === "tournament" ? input.opponent?.trim() || null : null,
      homeAway: input.type === "match" ? input.homeAway ?? "home" : null,
      notes: input.notes?.trim() || null,
      squadSize: v.squad,
      sponsorVisible: sponsorFlag(input.sponsorVisible),
      status: "active",
      statusReason: null,
      potmOpen: false,
      createdBy: user.id,
    };
    db.events.push(e);
    created.push(e);
  }
  if (input.notify) notifyEvent(created[0], "new", created.length);
  return { ok: true, data: created[0] };
}

export async function updateEvent(eventId: ID, input: EventInput & { scope?: "one" | "following" }): Promise<ActionResult<TeamEvent>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  const perm = isFixture(e.type) || isFixture(input.type) ? "schedule_games" : "schedule_events";
  if (!hasTeamPerm(user.id, e.teamId, perm)) return { ok: false, error: "You don't have permission to change this event." };
  const v = validateEvent(e.teamId, { ...input, repeatWeeks: "1" });
  if (Object.keys(v.fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: v.fieldErrors };
  const targets =
    input.scope === "following" && e.seriesId ? db.events.filter((x) => x.seriesId === e.seriesId && x.startAt >= e.startAt) : [e];
  const startDelta = Date.parse(v.startAt) - Date.parse(e.startAt);
  const duration = Date.parse(v.endAt) - Date.parse(v.startAt);
  for (const t of targets) {
    const startAt = t === e ? v.startAt : new Date(Date.parse(t.startAt) + startDelta).toISOString();
    Object.assign(t, {
      type: input.type,
      competition: isFixture(input.type) && input.competition ? input.competition : null,
      title: input.title?.trim() || null,
      startAt,
      endAt: new Date(Date.parse(startAt) + duration).toISOString(),
      meetAt: v.meetMin ? new Date(Date.parse(startAt) - v.meetMin * 60000).toISOString() : null,
      venueId: v.venue?.id ?? null,
      locationText: v.venue?.name ?? (input.locationText?.trim() || null),
      opponent: input.type === "match" ? input.opponent?.trim() || null : input.type === "tournament" ? input.opponent?.trim() || null : null,
      homeAway: input.type === "match" ? input.homeAway ?? "home" : null,
      notes: input.notes?.trim() || null,
      squadSize: v.squad,
      sponsorVisible: sponsorFlag(input.sponsorVisible),
    });
  }
  if (input.notify) notifyEvent(e, "changed", targets.length);
  return { ok: true, data: e };
}

export async function setEventStatus(eventId: ID, status: TeamEvent["status"], reason?: string, notify = true): Promise<ActionResult<TeamEvent>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  const perm = isFixture(e.type) ? "schedule_games" : "schedule_events";
  if (!hasTeamPerm(user.id, e.teamId, perm)) return { ok: false, error: "You don't have permission to change this event." };
  e.status = status;
  e.statusReason = status === "active" ? null : reason?.trim() || null;
  if (notify) notifyEvent(e, status === "active" ? "reinstated" : status);
  return { ok: true, data: e };
}

export async function deleteEvent(eventId: ID, scope: "one" | "following" = "one"): Promise<ActionResult<{ teamId: ID; count: number }>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e) return { ok: false, error: "That event no longer exists." };
  const perm = isFixture(e.type) ? "schedule_games" : "schedule_events";
  if (!hasTeamPerm(user.id, e.teamId, perm)) return { ok: false, error: "You don't have permission to delete this event." };
  const ids = new Set((scope === "following" && e.seriesId ? db.events.filter((x) => x.seriesId === e.seriesId && x.startAt >= e.startAt) : [e]).map((x) => x.id));
  db.events = db.events.filter((x) => !ids.has(x.id));
  db.rsvps = db.rsvps.filter((x) => !ids.has(x.eventId));
  return { ok: true, data: { teamId: e.teamId, count: ids.size } };
}

// ---------------------------------------------------------------------------
// answers: players answer for themselves; captains can fill in for someone who told them
// ---------------------------------------------------------------------------

export async function setRsvp(eventId: ID, userId: ID, response: RsvpResponse, note?: string | null): Promise<ActionResult<Rsvp>> {
  const user = await requireUser();
  return writeRsvp(user.id, eventId, userId, response, note);
}

function writeRsvp(uid: ID, eventId: ID, userId: ID, response: RsvpResponse, note?: string | null): ActionResult<Rsvp> {
  const e = eventById(eventId);
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
    r = { id: newId(), eventId, userId, response, note: note?.trim() || null, respondedBy: uid, updatedAt: now() };
    db.rsvps.push(r);
  }
  return { ok: true, data: r };
}

export async function getAvailability(eventId: ID): Promise<Availability | null> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamMember(user.id, e.teamId)) return null;
  const staff = isTeamStaff(user.id, e.teamId);
  const rows = activePlayers(e.teamId)
    .map((r) => {
      const rsvp = db.rsvps.find((x) => x.eventId === e.id && x.userId === r.userId);
      const away = unavailableFor(r.userId!, e.teamId, e.startAt, e.tz);
      // Teammates see "unavailable"; only staff see why (injured, away) and the private note.
      const note = staff || r.userId === user.id ? rsvp?.note ?? (away ? away.note : null) : null;
      return {
        person: personFor(r),
        jersey: r.jersey,
        response: rsvp?.response ?? (away ? ("not_going" as const) : null),
        note: away && !rsvp ? (staff ? `${away.kind === "injured" ? "Injured" : away.kind === "away" ? "Away" : "Unavailable"}${note ? `: ${note}` : ""}` : "Unavailable") : note,
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
  const event = eventById(data.e)!;
  const p = profileById(data.u)!;
  return { ok: true, data: { event, person: { id: p.id, firstName: p.firstName, lastName: p.lastName }, response: data.r, teamName: teamById(event.teamId)!.name } };
}

export async function nudgeNonResponders(eventId: ID): Promise<ActionResult<{ sent: number }>> {
  const user = await requireUser();
  const e = eventById(eventId);
  if (!e || !isTeamStaff(user.id, e.teamId)) return { ok: false, error: "Only captains and managers can send reminders." };
  const sent = notifyEvent(e, "nudge");
  return { ok: true, data: { sent } };
}

// ---------------------------------------------------------------------------
// notifications (outbox; real layer sends through Resend + web push)
// ---------------------------------------------------------------------------

export function notifyEvent(e: TeamEvent, kind: "new" | "changed" | "postponed" | "cancelled" | "reinstated" | "nudge", count = 1): number {
  const team = teamById(e.teamId)!;
  const title = eventTitle(e);
  const when = `${formatLongDate(e.startAt, e.tz)}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}`;
  const noun = { match: "match", training: "training", tournament: "tournament", social: "event", other: "event" }[e.type];
  const subject = {
    new: count > 1 ? `${count} new ${noun}s from ${formatLongDate(e.startAt, e.tz)}` : `New ${noun}: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    changed: `Changed: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    postponed: `Postponed: ${title}`,
    cancelled: `Cancelled: ${title} · ${formatLongDate(e.startAt, e.tz)}`,
    reinstated: `Back on: ${title}`,
    nudge: `Are you in? ${title} · ${formatLongDate(e.startAt, e.tz)}`,
  }[kind];
  let sent = 0;
  for (const r of activePlayers(e.teamId)) {
    if (kind === "nudge" && (db.rsvps.some((x) => x.eventId === e.id && x.userId === r.userId) || unavailableFor(r.userId!, e.teamId, e.startAt, e.tz))) continue;
    const prefs = db.prefs.find((p) => p.userId === r.userId && p.teamId === e.teamId);
    if (prefs && !prefs.email) continue;
    if (prefs && kind === "new" && !prefs.newEvents) continue;
    if (prefs && kind === "nudge" && !prefs.reminders) continue;
    if (prefs && ["changed", "postponed", "cancelled", "reinstated"].includes(kind) && !prefs.changes) continue;
    const u = profileById(r.userId);
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
          : `${title}\n${when}${e.locationText ? `\n${e.locationText}` : ""}${e.notes ? `\n\n${e.notes}` : ""}${count > 1 ? `\n\nRepeats weekly, ${count} in total.` : ""}\n\nAre you in?`,
      links,
    });
    sent++;
  }
  return sent;
}

export async function listOutbox(): Promise<OutboxEmail[]> {
  return db.outbox.slice(0, 50);
}
