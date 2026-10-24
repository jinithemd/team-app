// Shapes match replica/schema.sql so the Supabase data layer can replace the fake one
// without touching screen code.

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

export interface Person {
  id: ID;
  userId: ID | null;
  firstName: string;
  lastName: string;
}

export interface Guardian {
  id: ID;
  personId: ID;
  userId: ID | null;
  invitedEmail: string | null;
  isPrimary: boolean;
  isSelf: boolean;
  status: "invited" | "active";
}

export interface Team {
  id: ID;
  name: string;
  sport: string;
  ageGroup: string | null;
  location: string | null;
  color: string;
  colorSecondary: string | null;
  orgName: string | null;
  joinCode: string;
  isPublic: boolean;
  rosterVisible: boolean;
  createdBy: ID;
  createdAt: string;
}

export const STAFF_PERMISSIONS = [
  "edit_settings",
  "roster",
  "schedule_games",
  "schedule_events",
  "scoring",
  "manage_permissions",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export type StaffRole = "head_coach" | "assistant_coach" | "manager" | "other";

export interface RosterMember {
  id: ID;
  teamId: ID;
  personId: ID;
  kind: "player" | "staff";
  jersey: string | null;
  position: string | null;
  staffRole: StaffRole | null;
  permissions: StaffPermission[];
  status: "invited" | "active" | "removed";
  invitedEmail: string | null;
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
  personId: ID;
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

export interface MyTeam extends Team {
  myRole: "staff" | "player" | "guardian";
  myPeople: Person[]; // kids (or me) on this team
  isStaff: boolean;
}

export interface RosterRow extends RosterMember {
  person: Person;
  guardians: { name: string; email: string | null; status: Guardian["status"] }[];
}

export interface EventWithMine extends TeamEvent {
  team: Pick<Team, "id" | "name" | "color" | "colorSecondary">;
  mine: { person: Person; response: RsvpResponse | null; note: string | null }[];
}

export interface Availability {
  counts: Record<RsvpResponse | "none", number>;
  rows: { person: Person; jersey: string | null; response: RsvpResponse | null; note: string | null }[];
  canSeeNotes: boolean;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
