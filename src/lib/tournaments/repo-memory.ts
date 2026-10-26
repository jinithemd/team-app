import "server-only";
import { randomUUID } from "node:crypto";
import { clubRoleFor, currentUserId, db, isTeamMember, isTeamStaff, teamById } from "../data/store";
import type { Repo, TeamRef } from "./repo";
import type { TeamEvent } from "../data/types";
import type { Entry, Match, MatchEvent, Official, OfficialRole, RosterPerson, Tournament } from "./types";

// Sample build: tournaments kept in memory next to the sample store (gone on restart).

interface Mem {
  tournaments: Tournament[];
  entries: Entry[];
  contacts: Record<string, string>;
  matches: Match[];
  events: MatchEvent[];
  officials: { tournamentId: string; userId: string; role: OfficialRole }[];
  roster?: RosterPerson[];
}
const g = globalThis as unknown as { __clbxTournaments?: Mem };
const mem = (g.__clbxTournaments ??= { tournaments: [], entries: [], contacts: {}, matches: [], events: [], officials: [] });
const now = () => new Date().toISOString();
const banners = ((globalThis as unknown as { __clbxBanners?: Map<string, string> }).__clbxBanners ??= new Map<string, string>());

async function me() {
  return currentUserId();
}
function runsClub(uid: string | null, clubId: string) {
  const r = uid ? clubRoleFor(uid, clubId) : null;
  return r === "owner" || r === "admin";
}
function organizerOf(uid: string | null, t: Tournament) {
  return runsClub(uid, t.clubId) || mem.officials.some((o) => o.tournamentId === t.id && o.userId === uid && o.role === "organizer");
}
function officialOf(uid: string | null, t: Tournament) {
  return organizerOf(uid, t) || mem.officials.some((o) => o.tournamentId === t.id && o.userId === uid);
}
function canView(uid: string | null, t: Tournament) {
  return (t.isPublic && t.status !== "draft") || officialOf(uid, t) || mem.entries.some((e) => e.tournamentId === t.id && e.teamId && uid && isTeamMember(uid, e.teamId));
}

export const memoryRepo: Repo = {
  uid: me,
  async myName() {
    const uid = await me();
    const p = db.profiles.find((x) => x.id === uid);
    return p ? `${p.firstName} ${p.lastName}` : "";
  },
  async clubsIRun() {
    const uid = await me();
    return db.clubs.filter((c) => runsClub(uid, c.id)).map((c) => ({ id: c.id, name: c.name }));
  },
  async teamsIRun() {
    const uid = await me();
    if (!uid) return [];
    return db.teams.filter((t) => isTeamStaff(uid, t.id)).map((t) => ({ id: t.id, name: t.name, crest: t.settings.crest, clubId: t.clubId }));
  },
  async clubName(clubId) {
    return db.clubs.find((c) => c.id === clubId)?.name ?? null;
  },
  async teamRefs(ids) {
    const m = new Map<string, TeamRef>();
    for (const id of ids) {
      const t = teamById(id);
      if (t) m.set(id, { id, name: t.name, crest: t.settings.crest, clubId: t.clubId });
    }
    return m;
  },
  async tournament(key) {
    const uid = await me();
    const t = mem.tournaments.find((x) => x.id === key || x.slug === key);
    return t && canView(uid, t) ? { ...t } : null;
  },
  async myTournamentIds() {
    const uid = await me();
    if (!uid) return [];
    const staffTeams = db.teams.filter((t) => isTeamStaff(uid, t.id)).map((t) => t.id);
    return mem.tournaments
      .filter((t) => officialOf(uid, t) || mem.entries.some((e) => e.tournamentId === t.id && e.teamId && (isTeamMember(uid, e.teamId) || staffTeams.includes(e.teamId))))
      .map((t) => t.id);
  },
  async tournamentsByIds(ids) {
    return mem.tournaments.filter((t) => ids.includes(t.id)).map((t) => ({ ...t }));
  },
  async isOrganizer(t) {
    return organizerOf(await me(), t);
  },
  async isOfficial(t) {
    return officialOf(await me(), t);
  },
  async entries(tid) {
    return mem.entries.filter((e) => e.tournamentId === tid).map((e) => ({ ...e }));
  },
  async entriesForTeams(teamIds) {
    return mem.entries.filter((e) => e.teamId && teamIds.includes(e.teamId)).map((e) => ({ ...e }));
  },
  async matches(tid) {
    return mem.matches.filter((m) => m.tournamentId === tid).map((m) => ({ ...m }));
  },
  async events(tid) {
    const ids = new Set(mem.matches.filter((m) => m.tournamentId === tid).map((m) => m.id));
    return mem.events.filter((e) => ids.has(e.matchId)).map((e) => ({ ...e }));
  },
  async officials(tid) {
    return mem.officials
      .filter((o) => o.tournamentId === tid)
      .map((o) => {
        const p = db.profiles.find((x) => x.id === o.userId);
        return { userId: o.userId, role: o.role, name: p ? `${p.firstName} ${p.lastName}` : "Someone" } satisfies Official;
      });
  },
  async contacts(tid) {
    const ids = new Set(mem.entries.filter((e) => e.tournamentId === tid).map((e) => e.id));
    return Object.fromEntries(Object.entries(mem.contacts).filter(([k]) => ids.has(k)));
  },
  async insertTournament(t) {
    const row = { ...t, id: randomUUID(), updatedAt: now() };
    mem.tournaments.push(row);
    return { ...row };
  },
  async updateTournament(id, patch) {
    const t = mem.tournaments.find((x) => x.id === id);
    if (t) Object.assign(t, patch, { updatedAt: now() });
  },
  async deleteTournament(id) {
    const mids = new Set(mem.matches.filter((m) => m.tournamentId === id).map((m) => m.id));
    mem.events = mem.events.filter((e) => !mids.has(e.matchId));
    mem.matches = mem.matches.filter((m) => m.tournamentId !== id);
    mem.entries = mem.entries.filter((e) => e.tournamentId !== id);
    mem.officials = mem.officials.filter((o) => o.tournamentId !== id);
    mem.tournaments = mem.tournaments.filter((t) => t.id !== id);
    db.events = db.events.filter((e) => e.tournamentId !== id);
  },
  async insertEntry(e, email) {
    const row = { ...e, id: randomUUID(), createdAt: now() };
    mem.entries.push(row);
    if (email) mem.contacts[row.id] = email;
    return { ...row };
  },
  async updateEntry(id, patch) {
    const e = mem.entries.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  },
  async deleteEntry(id) {
    mem.entries = mem.entries.filter((e) => e.id !== id);
    delete mem.contacts[id];
    for (const m of mem.matches) {
      if (m.homeId === id) m.homeId = null;
      if (m.awayId === id) m.awayId = null;
    }
  },
  async replaceMatches(tid, matches) {
    const old = new Set(mem.matches.filter((m) => m.tournamentId === tid).map((m) => m.id));
    mem.events = mem.events.filter((e) => !old.has(e.matchId));
    mem.matches = [...mem.matches.filter((m) => m.tournamentId !== tid), ...matches.map((m) => ({ ...m }))];
  },
  async updateMatches(list) {
    for (const p of list) {
      const m = mem.matches.find((x) => x.id === p.id);
      if (m) Object.assign(m, p);
    }
  },
  async insertEvent(e) {
    mem.events.push({ ...e, id: randomUUID() });
  },
  async deleteEvent(id) {
    mem.events = mem.events.filter((e) => e.id !== id);
  },
  async userIdByEmail(email) {
    return db.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase())?.id ?? null;
  },
  async addOfficial(tid, userId, role) {
    mem.officials = mem.officials.filter((o) => !(o.tournamentId === tid && o.userId === userId));
    mem.officials.push({ tournamentId: tid, userId, role });
  },
  async removeOfficial(tid, userId) {
    mem.officials = mem.officials.filter((o) => !(o.tournamentId === tid && o.userId === userId));
  },
  async respondInvite(entryId, accept) {
    const uid = await me();
    const e = mem.entries.find((x) => x.id === entryId);
    if (!e?.teamId || !uid || !isTeamStaff(uid, e.teamId)) throw new Error("Only the team's captains and managers can answer this.");
    if (!["invited", "accepted", "declined"].includes(e.status)) throw new Error("This invitation is no longer open.");
    e.status = accept ? "accepted" : "declined";
  },
  async apply(tid, teamId) {
    const uid = await me();
    const t = mem.tournaments.find((x) => x.id === tid);
    if (!t || !t.registrationOpen || !["registration", "draft"].includes(t.status) || !t.isPublic) throw new Error("This tournament isn't taking teams.");
    if (!uid || !isTeamStaff(uid, teamId)) throw new Error("Only the team's captains and managers can enter it.");
    const existing = mem.entries.find((e) => e.tournamentId === tid && e.teamId === teamId);
    if (existing) {
      if (["declined", "withdrawn"].includes(existing.status)) existing.status = "applied";
      return;
    }
    mem.entries.push({ id: randomUUID(), tournamentId: tid, teamId, name: teamById(teamId)!.name, status: "applied", paid: false, groupLabel: null, seed: null, apartSet: null, rosterSubmittedAt: null, createdAt: now() });
  },
  async withdraw(entryId) {
    const uid = await me();
    const e = mem.entries.find((x) => x.id === entryId);
    if (!e?.teamId || !uid || !isTeamStaff(uid, e.teamId)) throw new Error("Only the team's captains and managers can do this.");
    e.status = "withdrawn";
  },

  async isParticipant(t) {
    const uid = await me();
    return officialOf(uid, t) || mem.entries.some((e) => e.tournamentId === t.id && e.status === "accepted" && e.teamId && uid && isTeamMember(uid, e.teamId));
  },
  async roster(tid) {
    return rosterList().filter((p) => p.tournamentId === tid).map((p) => ({ ...p }));
  },
  // The same marks the database trigger sets in the live build.
  async insertRosterPerson(p) {
    const e = mem.entries.find((x) => x.id === p.entryId)!;
    const t = mem.tournaments.find((x) => x.id === e.tournamentId)!;
    const active = rosterList().filter((x) => x.entryId === p.entryId && x.hostChange !== "removed");
    if (p.role === "player" && t.rosterMax != null && active.filter((x) => x.role === "player").length >= t.rosterMax) throw new Error(`This tournament allows ${t.rosterMax} players per team.`);
    const sub = !!e.rosterSubmittedAt;
    rosterList().push({ ...p, id: randomUUID(), isCaptain: false, hostChange: sub ? "added" : null, hostChangedAt: sub ? now() : null, prevName: null, prevJersey: null, prevCaptain: null, createdAt: now() });
  },
  async updateRosterPerson(id, patch) {
    const r = rosterList().find((x) => x.id === id)!;
    const e = mem.entries.find((x) => x.id === r.entryId)!;
    if (r.name === patch.name && r.jersey === patch.jersey) return;
    if (e.rosterSubmittedAt) {
      if (r.hostChange === "removed") throw new Error("This person was removed from the roster.");
      if (!r.hostChange) Object.assign(r, { prevName: r.name, prevJersey: r.jersey, prevCaptain: r.isCaptain });
      r.hostChange = r.hostChange === "added" ? "added" : "edited";
      r.hostChangedAt = now();
    }
    Object.assign(r, patch);
  },
  async deleteRosterPerson(id) {
    const r = rosterList().find((x) => x.id === id);
    if (!r) return;
    const e = mem.entries.find((x) => x.id === r.entryId)!;
    if (!e.rosterSubmittedAt) {
      mem.roster = rosterList().filter((x) => x.id !== id);
      return;
    }
    if (r.hostChange === "removed") return;
    Object.assign(r, { prevName: r.prevName ?? r.name, prevJersey: r.prevJersey ?? r.jersey, prevCaptain: r.prevCaptain ?? r.isCaptain, isCaptain: false, hostChange: "removed", hostChangedAt: now() });
  },
  async submitRoster(entryId) {
    const e = mem.entries.find((x) => x.id === entryId)!;
    if (e.rosterSubmittedAt) throw new Error("This roster is already submitted.");
    e.rosterSubmittedAt = now();
  },
  async syncCalendar(tid, wanted) {
    const key = (teamId: string, mid: string | null | undefined) => `${teamId}:${mid ?? ""}`;
    const keep = new Set<string>();
    for (const w of wanted) {
      const k = key(w.teamId, w.tournamentMatchId);
      keep.add(k);
      const fields = {
        type: w.type, competition: w.type === "match" ? ("cup" as const) : null, title: w.title, startAt: w.startAt, endAt: w.endAt, locationText: w.locationText,
        opponent: w.opponent, homeAway: w.opponent ? ("neutral" as const) : null, notes: w.notes, status: w.status,
      };
      const old = db.events.find((e) => e.tournamentId === tid && key(e.teamId, e.tournamentMatchId) === k);
      if (old) Object.assign(old, fields);
      else {
        const e: TeamEvent = {
          id: randomUUID(), teamId: w.teamId, seasonId: null, seriesId: null, meetAt: null, tz: "America/Toronto", venueId: null, squadSize: null,
          statusReason: null, potmOpen: false, sponsorVisible: null, createdBy: null, tournamentId: tid, tournamentMatchId: w.tournamentMatchId, ...fields,
        };
        db.events.push(e);
      }
    }
    db.events = db.events.filter((e) => e.tournamentId !== tid || keep.has(key(e.teamId, e.tournamentMatchId)));
  },
  async banner(tid) {
    return banners.get(tid) ?? null;
  },
  async setBanner(tid, image) {
    if (image) banners.set(tid, image);
    else banners.delete(tid);
    const t = mem.tournaments.find((x) => x.id === tid);
    if (t) Object.assign(t, { bannerAt: image ? now() : null, updatedAt: now() });
  },
  async setCaptain(entryId, personId) {
    const e = mem.entries.find((x) => x.id === entryId)!;
    for (const r of rosterList().filter((x) => x.entryId === entryId && x.hostChange !== "removed")) {
      const want = r.id === personId;
      if (r.isCaptain === want) continue;
      if (e.rosterSubmittedAt) {
        if (!r.hostChange) Object.assign(r, { prevName: r.name, prevJersey: r.jersey, prevCaptain: r.isCaptain });
        r.hostChange = r.hostChange === "added" ? "added" : "edited";
        r.hostChangedAt = now();
      }
      r.isCaptain = want;
    }
  },
  async teamPlayers(teamId) {
    return db.roster
      .filter((r) => r.teamId === teamId && r.isPlayer && r.status === "active" && r.userId)
      .map((r) => {
        const p = db.profiles.find((x) => x.id === r.userId);
        const j = r.jersey?.trim();
        return { userId: r.userId, name: p ? `${p.firstName} ${p.lastName}` : "Player", jersey: j && /^\d{1,3}$/.test(j) ? Number(j) : null };
      });
  },
};

function rosterList(): RosterPerson[] {
  return (mem.roster ??= []);
}
