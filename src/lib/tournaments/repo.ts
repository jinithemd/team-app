import "server-only";
import type { Entry, Match, MatchEvent, Official, OfficialRole, RosterPerson, Tournament } from "./types";

/*
 * Storage for tournaments. Two implementations with the same shape: the sample build keeps
 * them in memory (repo-memory.ts), the live build in Supabase (repo-supabase.ts). The
 * service (service.ts) holds all the rules and calls only these.
 */

export interface TeamRef {
  id: string;
  name: string;
  crest: string | null;
  clubId: string | null;
}

/** A team event a tournament puts on a team's calendar: the tournament itself, or one game. */
export interface CalendarEvent {
  teamId: string;
  tournamentMatchId: string | null;
  type: "tournament" | "match";
  title: string;
  startAt: string;
  endAt: string;
  locationText: string | null;
  opponent: string | null;
  notes: string;
  status: "active" | "postponed" | "cancelled";
}

export interface Repo {
  uid(): Promise<string | null>;
  myName(): Promise<string>;
  /** Clubs I'm an owner or admin of (I can host for them). */
  clubsIRun(): Promise<{ id: string; name: string }[]>;
  /** Teams I'm staff of (I can answer invitations or apply for them). */
  teamsIRun(): Promise<TeamRef[]>;
  clubName(clubId: string): Promise<string | null>;
  teamRefs(ids: string[]): Promise<Map<string, TeamRef>>;

  tournament(idOrSlug: string): Promise<Tournament | null>;
  /** Tournaments I organize or officiate, or one of my teams is in or invited to. */
  myTournamentIds(): Promise<string[]>;
  tournamentsByIds(ids: string[]): Promise<Tournament[]>;
  isOrganizer(t: Tournament): Promise<boolean>;
  isOfficial(t: Tournament): Promise<boolean>;

  entries(tid: string): Promise<Entry[]>;
  entriesForTeams(teamIds: string[]): Promise<Entry[]>;
  matches(tid: string): Promise<Match[]>;
  events(tid: string): Promise<MatchEvent[]>;
  officials(tid: string): Promise<Official[]>;
  contacts(tid: string): Promise<Record<string, string>>;

  insertTournament(t: Omit<Tournament, "id" | "updatedAt">): Promise<Tournament>;
  updateTournament(id: string, patch: Partial<Tournament>): Promise<void>;
  deleteTournament(id: string): Promise<void>;
  insertEntry(e: Omit<Entry, "id" | "createdAt">, email?: string | null): Promise<Entry>;
  updateEntry(id: string, patch: Partial<Entry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  replaceMatches(tid: string, matches: Match[]): Promise<void>;
  updateMatches(list: (Partial<Match> & { id: string })[]): Promise<void>;
  insertEvent(e: Omit<MatchEvent, "id">): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  userIdByEmail(email: string): Promise<string | null>;
  addOfficial(tid: string, userId: string, role: OfficialRole): Promise<void>;
  removeOfficial(tid: string, userId: string): Promise<void>;
  respondInvite(entryId: string, accept: boolean): Promise<void>;
  apply(tid: string, teamId: string): Promise<void>;
  withdraw(entryId: string): Promise<void>;

  /** Organizers, officials and members of teams in it: who may see the rosters. */
  isParticipant(t: Tournament): Promise<boolean>;
  roster(tid: string): Promise<RosterPerson[]>;
  insertRosterPerson(p: Pick<RosterPerson, "tournamentId" | "entryId" | "role" | "name" | "jersey" | "userId">): Promise<void>;
  updateRosterPerson(id: string, patch: Pick<RosterPerson, "name" | "jersey">): Promise<void>;
  /** Before submission it's deleted; after, it stays on the roster marked "removed". */
  deleteRosterPerson(id: string): Promise<void>;
  submitRoster(entryId: string): Promise<void>;
  /** Make the tournament's events on team calendars exactly these (adds, updates, removes). */
  syncCalendar(tid: string, wanted: CalendarEvent[]): Promise<void>;
  /** One captain per roster (null: none). */
  setCaptain(entryId: string, personId: string | null): Promise<void>;
  /** Players on a Clbx team, to pick from. */
  teamPlayers(teamId: string): Promise<{ userId: string | null; name: string; jersey: number | null }[]>;
}
