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
  /** Changes whenever the profile (and so maybe the photo) changes: busts the image cache. */
  photoV?: string | null;
  /**
   * Live build: we don't load photos with profiles, so we only know one *might* exist and let
   * the image fall back to initials if it doesn't. Sample build: true only with a photo.
   */
  photoMaybe?: boolean;
}

/** A name to show for someone on a roster: an account, or an invite not yet accepted. */
export interface Person {
  id: ID; // the account id, or the roster row id while the invite is pending
  firstName: string;
  lastName: string;
  /** Profile photo URL (/api/img/photo/...), or none. Initials show if it doesn't load. */
  photo?: string | null;
}

export interface Club {
  id: ID;
  name: string;
  slug: string;
  color: string;
  colorSecondary: string | null;
  logo: string | null; // data URL in the sample build
  blurb: string | null;
  joinOpen: boolean; // anyone with the link can ask to join a team
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
  /** Secret in the team's invite link (/join/<token>). Resetting it kills the old link. */
  inviteToken: string;
  isPublic: boolean;
  rosterVisible: boolean;
  createdBy: ID;
  createdAt: string;
  settings: TeamSettings;
}

export interface JoinRequest {
  id: ID;
  teamId: ID;
  userId: ID;
  message: string | null;
  status: "pending" | "approved" | "declined";
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

export const EVENT_TYPES = ["match", "training", "tournament", "social", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  match: "Match",
  training: "Training",
  tournament: "Tournament",
  social: "Social",
  other: "Other",
};
/** Matches and tournaments need schedule_games; everything else schedule_events. */
export const isFixture = (t: EventType) => t === "match" || t === "tournament";
export type Competition = "league" | "cup" | "friendly";
export type EventStatus = "active" | "postponed" | "cancelled";

export interface TeamEvent {
  id: ID;
  teamId: ID;
  seasonId: ID | null;
  seriesId: ID | null; // weekly trainings share a series
  type: EventType;
  competition: Competition | null;
  title: string | null;
  startAt: string; // ISO, UTC
  endAt: string;
  meetAt: string | null; // "meet 30 min before"
  tz: string; // IANA zone the event happens in
  venueId: ID | null;
  locationText: string | null;
  opponent: string | null;
  homeAway: "home" | "away" | "neutral" | null;
  notes: string | null;
  squadSize: number | null;
  /** What each player pays for this one event (cents), paid online or recorded by staff. 0/undefined = free. */
  feeCents?: number | null;
  status: EventStatus;
  statusReason: string | null;
  potmOpen: boolean;
  /** null = the usual: matches, tournaments and socials show to sponsors, trainings don't. */
  sponsorVisible?: boolean | null;
  createdBy: ID | null;
  /** Put on the calendar by a tournament the team is in (kept in step by the tournament). */
  tournamentId?: ID | null;
  tournamentMatchId?: ID | null;
  /** The team calendar entry for a game session (booking happens on the session page). */
  sessionId?: ID | null;
}

export interface Venue {
  id: ID;
  teamId: ID;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  radiusM: number; // check-in area
}

export interface PointsRules {
  training: number;
  match: number;
  away_bonus: number;
  late_penalty: number;
  late_after_minutes: number;
  potm: number;
}
export const DEFAULT_POINTS_RULES: PointsRules = { training: 1, match: 2, away_bonus: 10, late_penalty: -1, late_after_minutes: 15, potm: 3 };

export interface TeamSettings {
  crest: string | null; // data URL in the sample build; Storage URL later
  pointsEnabled: boolean;
  pointsPublic: boolean;
  pointsRules: PointsRules;
  geoCheckinEnabled: boolean;
  membersCanPost: boolean;
  /** Sponsors and the whole team share one room. On unless captains switch it off. */
  sponsorChat?: boolean;
  /** People who join by the invite link wait for a captain's OK instead of joining straight away. */
  linkNeedsApproval?: boolean;
  /** Where players send e-Transfers, shown on the dues screen. */
  payTo?: string | null;
}

export interface Season {
  id: ID;
  teamId: ID;
  name: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
  closedAt: string | null;
}

export type UnavailableKind = "injured" | "away" | "other";
export interface AvailabilityPeriod {
  id: ID;
  userId: ID;
  teamIds: ID[]; // which of my teams this applies to
  kind: UnavailableKind;
  startsOn: string; // YYYY-MM-DD, inclusive
  endsOn: string; // inclusive
  note: string | null; // captains only
  createdAt: string;
}

export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export interface Attendance {
  eventId: ID;
  userId: ID;
  status: AttendanceStatus;
  minutesLate: number | null;
  method: "staff" | "geo";
  checkedInAt: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  recordedBy: ID | null;
  updatedAt: string;
}

export type PointsReason = "training" | "match" | "away_bonus" | "late_penalty" | "potm" | "manual";
export interface PointsEntry {
  id: ID;
  teamId: ID;
  seasonId: ID | null;
  userId: ID;
  eventId: ID | null;
  points: number;
  reason: PointsReason;
  note: string | null;
  createdBy: ID | null;
  createdAt: string;
}

export interface Score {
  eventId: ID;
  us: number;
  them: number;
  status: "not_started" | "live" | "final";
  period: string | null; // "1st half", "HT", "2nd half"
  version: number;
  updatedAt: string;
}

export type MatchEventKind = "goal" | "own_goal" | "assist" | "yellow" | "red";
export interface MatchEvent {
  id: ID;
  eventId: ID;
  minute: number | null;
  kind: MatchEventKind;
  side: "us" | "them";
  userId: ID | null;
  assistId: ID | null;
  note: string | null;
  createdAt: string;
}

/** Someone who runs one event (an away trip, a tournament) without being staff for the season. */
export const EVENT_PERMISSIONS = ["attendance", "scoring", "carpools"] as const;
export type EventPermission = (typeof EVENT_PERMISSIONS)[number];
export const EVENT_PERMISSION_LABEL: Record<EventPermission, string> = {
  attendance: "Take attendance",
  scoring: "Keep score",
  carpools: "Sort out carpools",
};
export interface EventManager {
  eventId: ID;
  userId: ID;
  permissions: EventPermission[];
}

export interface PotmVote {
  eventId: ID;
  voterId: ID;
  nomineeId: ID;
}

export interface RideOffer {
  id: ID;
  eventId: ID;
  driverId: ID;
  seats: number;
  leavesAt: string; // "11:45"
  from: string;
  note: string | null;
}
export interface RideRequest {
  id: ID;
  eventId: ID;
  userId: ID;
  from: string | null;
  offerId: ID | null; // null = still needs a ride
}

export interface Fee {
  id: ID;
  teamId: ID;
  seasonId: ID | null;
  name: string;
  amountCents: number;
  dueOn: string | null;
  createdAt: string;
}
export interface Due {
  id: ID;
  feeId: ID;
  userId: ID;
  amountCents: number;
}
export type PaymentMethod = "etransfer" | "cash" | "other" | "card";
export interface Payment {
  id: ID;
  dueId: ID;
  amountCents: number;
  method: PaymentMethod;
  ref: string | null;
  paidOn: string;
  reportedBy: ID;
  verifiedBy: ID | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: ID;
  teamId: ID;
  kind: "team" | "staff" | "sponsors";
}
export interface Poll {
  question: string;
  options: string[];
  multi: boolean;
}
export interface ChatMessage {
  id: ID;
  conversationId: ID;
  userId: ID;
  body: string;
  imageUrl: string | null;
  replyToId: ID | null;
  poll: Poll | null;
  pinned: boolean;
  createdAt: string;
  deletedAt: string | null;
}
export interface Reaction {
  messageId: ID;
  userId: ID;
  emoji: string;
}
export interface PollVote {
  messageId: ID;
  userId: ID;
  option: number;
}
export interface ReadMark {
  conversationId: ID;
  userId: ID;
  lastReadAt: string;
}

export interface TeamMessage {
  id: ID;
  teamId: ID;
  fromId: ID;
  subject: string;
  body: string;
  recipientIds: ID[];
  createdAt: string;
  toSponsors?: boolean;
}

// ---- sponsors ------------------------------------------------------------

export const SPONSOR_TIERS = ["diamond", "platinum", "gold", "silver", "bronze"] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];
export const TIER_LABEL: Record<SponsorTier, string> = { diamond: "Diamond", platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze" };

export interface Sponsor {
  id: ID;
  clubId: ID | null; // a club sponsor backs every club team
  teamId: ID | null;
  name: string;
  /** The badge (Diamond … Bronze), or none. */
  tier: SponsorTier | null;
  logo: string | null;
  website: string | null;
  blurb: string | null;
  contactUserId: ID | null;
  invitedEmail: string | null;
  status: "invited" | "active" | "ended";
  startsOn: string | null;
  endsOn: string | null;
  createdBy: ID | null;
  createdAt: string;
}

/** Shown to everyone: no emails, no contact. */
export interface PublicSponsor {
  id: ID;
  name: string;
  tier: SponsorTier | null;
  logo: string | null;
  website: string | null;
  blurb: string | null;
  scope: "team" | "club";
}

export const showsToSponsors = (e: { type: EventType; sponsorVisible?: boolean | null }) =>
  e.sponsorVisible ?? (e.type === "match" || e.type === "tournament" || e.type === "social");

export interface NotificationPrefs {
  userId: ID;
  teamId: ID;
  newEvents: boolean;
  changes: boolean;
  reminders: boolean;
  chat: "all" | "mentions" | "off";
  email: boolean;
  push: boolean;
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
  team: Pick<Team, "id" | "name" | "color" | "colorSecondary"> & { crestUrl: string | null };
  venue: Venue | null;
  /** My answer, when I play on this team. null when I'm only staff there. */
  mine: { response: RsvpResponse | null; note: string | null; unavailable: UnavailableKind | null } | null;
  score: Pick<Score, "us" | "them" | "status"> | null;
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
