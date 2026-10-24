// Shapes match replica/schema.sql so the Supabase data layer can replace the fake one
// without touching screen code.
//
// Adult model: every player has their own account. One account can wear several hats:
// club owner/admin/treasurer (ClubAdmin), and on each team a roster row that says whether
// they play (isPlayer), which roles they hold (captain, manager, ...) and what they can do.

export type ID = string;

export interface Profile {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  theme: "system" | "light" | "dark";
  useTeamColors: boolean;
}

/** A name to show for someone on a roster: an account, or an invite not yet accepted. */
export interface Person {
  id: ID; // the account id, or the roster row id while the invite is pending
  firstName: string;
  lastName: string;
}

export interface Club {
  id: ID;
  name: string;
  slug: string;
  color: string;
  colorSecondary: string | null;
  createdBy: ID;
  createdAt: string;
}

export type ClubRole = "owner" | "admin" | "treasurer";

export interface ClubAdmin {
  clubId: ID;
  userId: ID;
  role: ClubRole;
}

export interface Team {
  id: ID;
  clubId: ID | null;
  name: string;
  sport: string;
  level: string | null; // "Sunday league", "Division 2", "Over-35s"
  location: string | null;
  color: string;
  colorSecondary: string | null;
  joinCode: string;
  isPublic: boolean;
  rosterVisible: boolean;
  createdBy: ID;
  createdAt: string;
}

export const TEAM_PERMISSIONS = [
  "edit_settings",
  "roster",
  "schedule_games",
  "schedule_events",
  "attendance",
  "scoring",
  "payments",
  "messages",
  "manage_permissions",
] as const;
export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export const TEAM_ROLES = ["captain", "vice_captain", "manager", "coach", "treasurer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const ROLE_LABEL: Record<TeamRole, string> = {
  captain: "Captain",
  vice_captain: "Vice captain",
  manager: "Manager",
  coach: "Coach",
  treasurer: "Treasurer",
};

export const CLUB_ROLE_LABEL: Record<ClubRole, string> = { owner: "Club owner", admin: "Club admin", treasurer: "Club treasurer" };

export const PERMISSION_LABEL: Record<TeamPermission, string> = {
  schedule_games: "Add and change matches",
  schedule_events: "Add trainings and events",
  roster: "Add and remove people",
  attendance: "Take attendance",
  scoring: "Keep score and results",
  messages: "Message the whole team",
  payments: "Track dues and payments",
  edit_settings: "Edit team settings",
  manage_permissions: "Give out roles and permissions",
};

/** What each role can do by default. Someone with several roles gets all of them. */
export const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  captain: ["roster", "schedule_events", "attendance", "scoring", "messages"],
  vice_captain: ["attendance", "scoring", "messages"],
  manager: ["roster", "schedule_games", "schedule_events", "attendance", "messages", "edit_settings"],
  coach: ["schedule_events", "attendance", "scoring"],
  treasurer: ["payments"],
};

export function permissionsForRoles(roles: TeamRole[]): TeamPermission[] {
  const set = new Set<TeamPermission>();
  roles.forEach((r) => ROLE_PERMISSIONS[r].forEach((p) => set.add(p)));
  return TEAM_PERMISSIONS.filter((p) => set.has(p));
}

export interface RosterMember {
  id: ID;
  teamId: ID;
  userId: ID | null; // null until the invite is accepted
  invitedEmail: string | null;
  invitedName: { firstName: string; lastName: string } | null;
  isPlayer: boolean;
  roles: TeamRole[];
  jersey: string | null;
  position: string | null;
  permissions: TeamPermission[];
  status: "invited" | "active" | "inactive" | "removed";
}

export type EventType = "game" | "practice" | "event";
export type EventStatus = "active" | "postponed" | "cancelled";

export interface TeamEvent {
  id: ID;
  teamId: ID;
  type: EventType;
  title: string | null;
  startAt: string; // ISO, UTC
  endAt: string;
  tz: string; // IANA zone the event happens in
  locationText: string | null;
  opponent: string | null;
  homeAway: "home" | "away" | "neutral" | null;
  notes: string | null;
  status: EventStatus;
  statusReason: string | null;
  createdBy: ID | null;
}

export type RsvpResponse = "going" | "not_going" | "maybe";

export interface Rsvp {
  id: ID;
  eventId: ID;
  userId: ID;
  response: RsvpResponse;
  note: string | null;
  respondedBy: ID | null;
  updatedAt: string;
}

export interface OutboxEmail {
  id: ID;
  to: string;
  subject: string;
  text: string;
  links: { label: string; href: string }[];
  createdAt: string;
}

// ---- view models returned to screens ----

/** Everything one person is on a team, in display order: Player, Captain, Manager, Club owner. */
export interface Hats {
  isPlayer: boolean;
  roles: TeamRole[];
  clubRole: ClubRole | null;
  isCreator: boolean;
}

export interface MyTeam extends Team {
  club: Pick<Club, "id" | "name" | "slug"> | null;
  /** My roster row, if I'm on the roster (club admins can see teams they aren't on). */
  me: Pick<RosterMember, "id" | "isPlayer" | "roles" | "jersey" | "position" | "permissions"> | null;
  hats: Hats;
  /** Can use the captain tools: any permission on this team, the creator, or a club admin. */
  isStaff: boolean;
  canManagePermissions: boolean;
}

export interface MyClub extends Club {
  myRole: ClubRole;
  teamCount: number;
}

export interface RosterRow extends RosterMember {
  person: Person;
  clubRole: ClubRole | null;
  email: string | null; // staff only
}

export interface EventWithMine extends TeamEvent {
  team: Pick<Team, "id" | "name" | "color" | "colorSecondary">;
  /** My answer, when I play on this team. null when I'm only staff there. */
  mine: { response: RsvpResponse | null; note: string | null } | null;
}

export interface Availability {
  counts: Record<RsvpResponse | "none", number>;
  rows: { person: Person; jersey: string | null; response: RsvpResponse | null; note: string | null }[];
  canSeeNotes: boolean;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** "Player #9 · Captain · Manager · Club owner" */
export function hatLabels(h: Hats, jersey?: string | null): string[] {
  const out: string[] = [];
  if (h.isPlayer) out.push(jersey ? `Player #${jersey}` : "Player");
  h.roles.forEach((r) => out.push(ROLE_LABEL[r]));
  if (h.clubRole) out.push(CLUB_ROLE_LABEL[h.clubRole]);
  if (!out.length && h.isCreator) out.push("Organiser");
  return out;
}
