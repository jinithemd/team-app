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
  createdAt: string;
}

export interface Match extends EngineMatch {
  tournamentId: string;
  kickoffAt: string | null;
  pitch: string | null;
  status: MatchStatus;
}

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
