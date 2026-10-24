import "server-only";
import { randomUUID } from "node:crypto";
import { getSessionUserId } from "./session";
import { utcToZoned } from "../time";
import type {
  Attendance,
  AvailabilityPeriod,
  ChatMessage,
  Club,
  ClubAdmin,
  ClubRole,
  Conversation,
  Due,
  Fee,
  Hats,
  ID,
  JoinRequest,
  MatchEvent,
  NotificationPrefs,
  OutboxEmail,
  Payment,
  Person,
  PointsEntry,
  PollVote,
  PotmVote,
  Profile,
  Reaction,
  ReadMark,
  RideOffer,
  RideRequest,
  RosterMember,
  Rsvp,
  Score,
  Season,
  Team,
  TeamEvent,
  TeamMessage,
  TeamPermission,
  UnavailableKind,
  Venue,
} from "./types";
import { TEAM_ROLES } from "./types";
import { seed } from "./seed";

/*
 * The sample-data store and the access rules every data function uses. The rules mirror the
 * SQL helper functions in replica/schema.sql (is_team_staff, has_team_perm, ...), so screens
 * behave the same when the Supabase layer replaces this one. Data resets on server restart.
 */

export interface Store {
  profiles: Profile[];
  clubs: Club[];
  clubAdmins: ClubAdmin[];
  joinRequests: JoinRequest[];
  teams: Team[];
  roster: RosterMember[];
  venues: Venue[];
  seasons: Season[];
  events: TeamEvent[];
  rsvps: Rsvp[];
  availability: AvailabilityPeriod[];
  attendance: Attendance[];
  points: PointsEntry[];
  scores: Score[];
  matchEvents: MatchEvent[];
  potmVotes: PotmVote[];
  rideOffers: RideOffer[];
  rideRequests: RideRequest[];
  fees: Fee[];
  dues: Due[];
  payments: Payment[];
  conversations: Conversation[];
  chat: ChatMessage[];
  reactions: Reaction[];
  pollVotes: PollVote[];
  reads: ReadMark[];
  messages: TeamMessage[];
  prefs: NotificationPrefs[];
  outbox: OutboxEmail[];
}

export const APP_URL = process.env.APP_URL || "http://localhost:3000";
export const now = () => new Date().toISOString();
export const newId = () => randomUUID();
export const norm = (e: string) => e.trim().toLowerCase();
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const g = globalThis as unknown as { __teamAppStoreV3?: Store };
export const db: Store = (g.__teamAppStoreV3 ??= seed());

// ---------------------------------------------------------------------------
// access rules
// ---------------------------------------------------------------------------

export function teamById(teamId: ID) {
  return db.teams.find((t) => t.id === teamId);
}
export function eventById(eventId: ID) {
  return db.events.find((e) => e.id === eventId);
}
export function profileById(userId: ID | null | undefined) {
  return userId ? db.profiles.find((p) => p.id === userId) : undefined;
}
export function clubRoleFor(uid: ID, clubId: ID | null): ClubRole | null {
  if (!clubId) return null;
  return db.clubAdmins.find((a) => a.clubId === clubId && a.userId === uid)?.role ?? null;
}
export function isClubAdmin(uid: ID, clubId: ID | null) {
  const r = clubRoleFor(uid, clubId);
  return r === "owner" || r === "admin";
}
export function isClubAdminOfTeam(uid: ID, teamId: ID) {
  return isClubAdmin(uid, teamById(teamId)?.clubId ?? null);
}
export function myRow(uid: ID, teamId: ID) {
  return db.roster.find((r) => r.teamId === teamId && r.userId === uid && (r.status === "active" || r.status === "inactive"));
}
export function hasTeamPerm(uid: ID, teamId: ID, perm: TeamPermission) {
  const team = teamById(teamId);
  if (!team) return false;
  if (team.createdBy === uid || isClubAdminOfTeam(uid, teamId)) return true;
  if (perm === "payments" && clubRoleFor(uid, team.clubId) === "treasurer") return true;
  const row = myRow(uid, teamId);
  return !!row && row.status === "active" && row.permissions.includes(perm);
}
export function isTeamStaff(uid: ID, teamId: ID) {
  const team = teamById(teamId);
  if (!team) return false;
  if (team.createdBy === uid || isClubAdminOfTeam(uid, teamId)) return true;
  const row = myRow(uid, teamId);
  return !!row && row.status === "active" && row.permissions.length > 0;
}
export function isTeamMember(uid: ID, teamId: ID) {
  const team = teamById(teamId);
  if (team && clubRoleFor(uid, team.clubId) === "treasurer") return true;
  return isTeamStaff(uid, teamId) || !!myRow(uid, teamId);
}
export function isActivePlayer(userId: ID, teamId: ID) {
  const row = myRow(userId, teamId);
  return !!row && row.status === "active" && row.isPlayer;
}
export function activePlayers(teamId: ID) {
  return db.roster.filter((r) => r.teamId === teamId && r.isPlayer && r.status === "active" && r.userId);
}

export async function currentUserId(): Promise<ID | null> {
  const uid = await getSessionUserId();
  return uid && db.profiles.some((p) => p.id === uid) ? uid : null;
}
export async function requireUser(): Promise<Profile> {
  const uid = await getSessionUserId();
  const user = uid ? db.profiles.find((p) => p.id === uid) : undefined;
  if (!user) throw new Error("Not signed in");
  return user;
}

export function personOf(userId: ID): Person {
  const p = profileById(userId);
  return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: userId, firstName: "Someone", lastName: "" };
}
export function personFor(r: RosterMember): Person {
  const p = profileById(r.userId);
  if (p) return { id: p.id, firstName: p.firstName, lastName: p.lastName };
  return { id: r.id, firstName: r.invitedName?.firstName ?? "", lastName: r.invitedName?.lastName ?? "" };
}
export const fullName = (p: Person) => `${p.firstName} ${p.lastName}`.trim();

export function hatsFor(uid: ID, team: Team): Hats {
  const row = myRow(uid, team.id);
  return {
    isPlayer: !!row?.isPlayer,
    roles: row ? TEAM_ROLES.filter((r) => row.roles.includes(r)) : [],
    clubRole: clubRoleFor(uid, team.clubId),
    isCreator: team.createdBy === uid,
  };
}

/** Is this player marked unavailable on the day of this event (in the event's zone)? */
export function unavailableFor(userId: ID, teamId: ID, startAt: string, tz: string): AvailabilityPeriod | null {
  const day = utcToZoned(startAt, tz).date;
  return db.availability.find((a) => a.userId === userId && a.teamIds.includes(teamId) && a.startsOn <= day && day <= a.endsOn) ?? null;
}
export function unavailableKind(userId: ID, teamId: ID, startAt: string, tz: string): UnavailableKind | null {
  return unavailableFor(userId, teamId, startAt, tz)?.kind ?? null;
}

export function openSeason(teamId: ID) {
  return db.seasons.find((s) => s.teamId === teamId && !s.closedAt) ?? null;
}

export function queueEmail(m: Omit<OutboxEmail, "id" | "createdAt">) {
  db.outbox.unshift({ ...m, id: newId(), createdAt: now() });
}

/** Distance in metres between two points (haversine). Same formula as check_in() in SQL. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
