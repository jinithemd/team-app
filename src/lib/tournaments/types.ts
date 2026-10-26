import type { EngineMatch, Format, MatchStatus } from "./engine";

export type TournamentStatus = "draft" | "registration" | "in_progress" | "finished";
export type EntryStatus = "invited" | "applied" | "accepted" | "declined" | "withdrawn";
export type EventKind = "goal" | "own_goal" | "penalty_goal" | "yellow" | "red";
export type OfficialRole = "organizer" | "official";

export interface Tournament {
  id: string;
  clubId: string;
  slug: string;
  name: string;
  logo: string | null;
  format: Format;
  legs: 1 | 2;
  groupCount: number;
  advancePerGroup: number;
  startsOn: string;
  endsOn: string;
  venueName: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  rules: string | null;
  feeCents: number;
  currency: string;
  payTo: string | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  maxTeams: number | null;
  status: TournamentStatus;
  isPublic: boolean;
  registrationOpen: boolean;
  /** Roster limits and criteria set by the host. */
  rosterMax: number | null;
  rosterMin: number | null;
  rosterRules: string | null;
  /** Teams can't change their roster after this (and never after their first kick-off). */
  rosterDeadline: string | null;
  /** When the banner / poster was last set (null: none). The image itself is stored apart. */
  bannerAt: string | null;
  createdBy: string | null;
  updatedAt: string;
}

export interface Entry {
  id: string;
  tournamentId: string;
  teamId: string | null;
  name: string;
  status: EntryStatus;
  paid: boolean;
  groupLabel: string | null;
  seed: number | null;
  /** Teams with the same set number are never drawn in the same group (e.g. one club's teams). */
  apartSet: number | null;
  /** Once set, only the host can change the roster, and each change is marked. */
  rosterSubmittedAt: string | null;
  createdAt: string;
}

export type RosterRole = "player" | "manager" | "coach";
export type HostChange = "added" | "edited" | "removed";

/** One person on a team's tournament roster. */
export interface RosterPerson {
  id: string;
  tournamentId: string;
  entryId: string;
  role: RosterRole;
  name: string;
  jersey: number | null;
  userId: string | null;
  isCaptain: boolean;
  /** Set when the host changed this after the team submitted. */
  hostChange: HostChange | null;
  hostChangedAt: string | null;
  /** What it was before the host's first change. */
  prevName: string | null;
  prevJersey: number | null;
  prevCaptain: boolean | null;
  createdAt: string;
}

export interface Match extends EngineMatch {
  tournamentId: string;
  kickoffAt: string | null;
  pitch: string | null;
  status: MatchStatus;
  /** Player of the match (optional): a roster person from either team. */
  motmRosterId: string | null;
}

/** An award the host gives out: to a player on a roster, or to a whole team. */
export interface Award {
  id: string;
  tournamentId: string;
  title: string;
  entryId: string | null;
  rosterId: string | null;
  note: string | null;
  sort: number;
}

export const AWARD_PRESETS = ["Best player", "Top scorer", "Best goalkeeper", "Best defender", "Best young player", "Fair play"] as const;

export interface MatchEvent {
  id: string;
  matchId: string;
  entryId: string;
  kind: EventKind;
  minute: number | null;
  player: string | null;
}

export interface Official {
  userId: string;
  name: string;
  role: OfficialRole;
}

export const EVENT_LABEL: Record<EventKind, string> = {
  goal: "Goal",
  penalty_goal: "Penalty goal",
  own_goal: "Own goal",
  yellow: "Yellow card",
  red: "Red card",
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  registration: "Taking teams",
  in_progress: "Under way",
  finished: "Finished",
};
