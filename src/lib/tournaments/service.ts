import "server-only";
import { randomUUID } from "node:crypto";
import { LIVE } from "../mode";
import { crestUrl } from "../images";
import { memoryRepo } from "./repo-memory";
import { supabaseRepo } from "./repo-supabase";
import type { CalendarEvent, Repo } from "./repo";
import { champion, runnerUp, describeSource, generateFixtures as engineFixtures, resolveTournament, standings, type EngineEntry, type Format, type StandingRow } from "./engine";
import type { Award, Entry, EventKind, Match, MatchEvent, Official, OfficialRole, RosterPerson, RosterRole, Tournament, TournamentStatus } from "./types";

/*
 * Every tournament rule lives here: who may do what, validation, fixture generation and
 * keeping brackets and statuses in step with results. Pages and actions call only this.
 */

const repo: Repo = LIVE ? supabaseRepo : memoryRepo;
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const fail = (error: string, fieldErrors?: Record<string, string>): Result<never> => ({ ok: false, error, fieldErrors });
const caught = async <T>(fn: () => Promise<Result<T>>): Promise<Result<T>> => {
  try {
    return await fn();
  } catch (e) {
    return fail((e as Error).message || "Something went wrong. Try again.");
  }
};

export type Role = "organizer" | "official" | "viewer";

export const tournamentLogoUrl = (t: Pick<Tournament, "id" | "logo" | "updatedAt">) =>
  t.logo ? `/api/img/tlogo/${t.id}?v=${encodeURIComponent(t.updatedAt)}` : null;

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------

export async function hostableClubs() {
  return repo.clubsIRun();
}

export async function listMyTournaments() {
  const [ids, teams, clubs] = await Promise.all([repo.myTournamentIds(), repo.teamsIRun(), repo.clubsIRun()]);
  const all = await repo.tournamentsByIds(ids);
  const myEntries = await repo.entriesForTeams(teams.map((t) => t.id));
  const clubIds = new Set(clubs.map((c) => c.id));
  const byT = new Map<string, Entry[]>();
  for (const e of myEntries) byT.set(e.tournamentId, [...(byT.get(e.tournamentId) ?? []), e]);
  const card = async (t: Tournament) => ({
    t,
    logoUrl: tournamentLogoUrl(t),
    bannerUrl: tournamentBannerUrl(t),
    clubName: await repo.clubName(t.clubId),
    mine: (byT.get(t.id) ?? []).map((e) => ({ entryId: e.id, status: e.status, teamName: teams.find((x) => x.id === e.teamId)?.name ?? e.name })),
  });
  const cards = await Promise.all(all.sort((a, b) => b.startsOn.localeCompare(a.startsOn)).map(card));
  const organizing = await Promise.all(cards.map((c) => repo.isOfficial(c.t)));
  return {
    canHost: clubs.length > 0,
    /** Runs a team but no club: Host leads to "make your team a club". */
    runsTeams: teams.length > 0,
    hosting: cards.filter((c, i) => clubIds.has(c.t.clubId) || organizing[i]),
    invitations: cards.flatMap((c) => c.mine.filter((m) => m.status === "invited").map((m) => ({ ...c, invite: m }))),
    playing: cards.filter((c, i) => !(clubIds.has(c.t.clubId) || organizing[i]) && c.mine.some((m) => m.status === "accepted" || m.status === "applied")),
  };
}

export interface EntryView extends Entry {
  crestUrl: string | null;
  contactEmail?: string;
  mine: boolean;
  /** One of the host club's own teams. */
  hostClub: boolean;
}
export interface MatchView extends Match {
  home: { name: string; crestUrl: string | null; teamId: string | null } | null;
  away: { name: string; crestUrl: string | null; teamId: string | null } | null;
  homeLabel: string;
  awayLabel: string;
  events: MatchEvent[];
  /** Player of the match, if one was chosen. */
  motm: { name: string; jersey: number | null; team: string } | null;
}

export interface AwardView extends Award {
  winner: string;
  team: string | null;
  crestUrl: string | null;
  jersey: number | null;
}

export interface TournamentView {
  bannerUrl: string | null;
  t: Tournament;
  logoUrl: string | null;
  clubName: string | null;
  role: Role;
  entries: EntryView[];
  matches: MatchView[];
  tables: { label: string | null; rows: StandingRow[]; advance: number }[];
  championId: string | null;
  officials: Official[];
  /** Teams I run that could still enter (public page and dashboard). */
  canApplyWith: { id: string; name: string }[];
  signedIn: boolean;
  awards: AwardView[];
  /** Goals from the match reports, most first (own goals don't count). */
  topScorers: { name: string; team: string; goals: number }[];
}

export async function getTournament(key: string): Promise<TournamentView | null> {
  const t = await repo.tournament(key);
  if (!t) return null;
  const uid = await repo.uid();
  const [organizer, official, entries, matches, events, myTeams] = await Promise.all([
    uid ? repo.isOrganizer(t) : false,
    uid ? repo.isOfficial(t) : false,
    repo.entries(t.id),
    repo.matches(t.id),
    repo.events(t.id),
    uid ? repo.teamsIRun() : Promise.resolve([]),
  ]);
  const role: Role = organizer ? "organizer" : official ? "official" : "viewer";
  const [contacts, officials, refs, clubName] = await Promise.all([
    organizer ? repo.contacts(t.id) : Promise.resolve({} as Record<string, string>),
    official ? repo.officials(t.id) : Promise.resolve([]),
    repo.teamRefs(entries.map((e) => e.teamId).filter((x): x is string => !!x)),
    repo.clubName(t.clubId),
  ]);
  const myTeamIds = new Set(myTeams.map((x) => x.id));
  const ev: EntryView[] = entries.map((e) => ({
    ...e,
    crestUrl: e.teamId ? crestUrl(e.teamId, refs.get(e.teamId)?.crest) : null,
    contactEmail: contacts[e.id],
    mine: !!e.teamId && myTeamIds.has(e.teamId),
    hostClub: !!e.teamId && !!t.clubId && refs.get(e.teamId)?.clubId === t.clubId,
  }));
  const byId = new Map(ev.map((e) => [e.id, e]));
  const side = (id: string | null) => {
    const e = id ? byId.get(id) : undefined;
    return e ? { name: e.name, crestUrl: e.crestUrl, teamId: e.teamId } : null;
  };
  const awards = await repo.awards(t.id).catch(() => [] as Award[]);
  const winners = new Map(
    (await repo.rosterPeople(t.id, [...new Set([...matches.map((m) => m.motmRosterId), ...awards.map((x) => x.rosterId)].filter((x): x is string => !!x))]).catch(() => [] as RosterPerson[])).map((p) => [p.id, p]),
  );
  const motmOf = (m: Match) => {
    const p = m.motmRosterId ? winners.get(m.motmRosterId) : undefined;
    return p ? { name: p.name, jersey: p.jersey, team: byId.get(p.entryId)?.name ?? "" } : null;
  };
  const mv: MatchView[] = matches
    .sort((a, b) => a.round - b.round || (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") || a.slot - b.slot)
    .map((m) => ({
      ...m,
      home: side(m.homeId),
      away: side(m.awayId),
      homeLabel: side(m.homeId)?.name ?? describeSource(m.homeSource, matches),
      awayLabel: side(m.awayId)?.name ?? describeSource(m.awaySource, matches),
      events: events.filter((x) => x.matchId === m.id),
      motm: motmOf(m),
    }));
  const awardViews: AwardView[] = awards.map((x) => {
    const p = x.rosterId ? winners.get(x.rosterId) : undefined;
    const e = byId.get(p?.entryId ?? x.entryId ?? "");
    return { ...x, winner: p?.name ?? e?.name ?? "", team: p ? e?.name ?? null : null, crestUrl: e?.crestUrl ?? null, jersey: p?.jersey ?? null };
  });
  const goals = new Map<string, { name: string; team: string; goals: number }>();
  for (const ev of events.filter((x) => (x.kind === "goal" || x.kind === "penalty_goal") && x.player?.trim())) {
    const team = byId.get(ev.entryId)?.name ?? "";
    const k = `${ev.entryId}:${ev.player!.trim().toLowerCase()}`;
    const g = goals.get(k) ?? { name: ev.player!.trim(), team, goals: 0 };
    g.goals++;
    goals.set(k, g);
  }
  const pts = { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss };
  const accepted = entries.filter((e) => e.status === "accepted");
  const engineEntries: EngineEntry[] = accepted.map((e) => ({ id: e.id, name: e.name, seed: e.seed, groupLabel: e.groupLabel }));
  let tables: TournamentView["tables"] = [];
  if (t.format === "league" || t.format === "round_robin") tables = [{ label: null, rows: standings(engineEntries, matches.filter((m) => m.stage === "league"), pts), advance: 1 }];
  if (t.format === "groups_knockout") {
    const labels = [...new Set(accepted.map((e) => e.groupLabel).filter((x): x is string => !!x))].sort();
    tables = labels.map((l) => ({ label: l, rows: standings(engineEntries.filter((e) => e.groupLabel === l), matches.filter((m) => m.stage === "group" && m.groupLabel === l), pts), advance: t.advancePerGroup }));
  }
  const entered = new Set(entries.filter((e) => e.teamId && !["declined", "withdrawn"].includes(e.status)).map((e) => e.teamId));
  return {
    t,
    logoUrl: tournamentLogoUrl(t),
    bannerUrl: tournamentBannerUrl(t),
    clubName,
    role,
    entries: ev,
    matches: mv,
    tables,
    championId: champion(engineEntries, matches, t.format, pts),
    officials,
    canApplyWith: t.registrationOpen && t.isPublic && ["draft", "registration"].includes(t.status) ? myTeams.filter((x) => !entered.has(x.id)).map((x) => ({ id: x.id, name: x.name })) : [],
    signedIn: !!uid,
    awards: awardViews,
    topScorers: [...goals.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 10),
  };
}

export async function tournamentLogo(id: string): Promise<string | null> {
  return (await repo.tournament(id))?.logo ?? null;
}

/** The banner / poster, for whoever can see the tournament. */
export async function tournamentBanner(id: string): Promise<string | null> {
  const t = await repo.tournament(id);
  return t?.bannerAt ? repo.banner(t.id) : null;
}

export const tournamentBannerUrl = (t: Pick<Tournament, "id" | "bannerAt">) => (t.bannerAt ? `/api/img/tbanner/${t.id}?v=${encodeURIComponent(t.bannerAt)}` : null);

const BANNER = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const BANNER_MAX_CHARS = 2_000_000;

/** Today in Toronto, as YYYY-MM-DD. */
const torontoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** The location can change until the tournament's first day starts. */
export const venueLocked = (t: Pick<Tournament, "startsOn">) => torontoToday() >= t.startsOn;

// ---------------------------------------------------------------------------
// creating and editing
// ---------------------------------------------------------------------------

export interface TournamentInput {
  clubId: string;
  name: string;
  logo?: string | null;
  format: string;
  legs: string;
  groupCount: string;
  advancePerGroup: string;
  startsOn: string;
  endsOn: string;
  venueName: string;
  venueAddress: string;
  venueLat: string;
  venueLng: string;
  rules: string;
  fee: string;
  payTo: string;
  maxTeams: string;
  pointsWin: string;
  pointsDraw: string;
  pointsLoss: string;
  isPublic: boolean;
  registrationOpen: boolean;
  /** Data URL, null to remove, undefined to leave as is. */
  banner?: string | null;
  rosterMax: string;
  rosterMin: string;
  rosterRules: string;
  /** ISO time, or empty. */
  rosterDeadline: string;
}

const FORMATS: Format[] = ["league", "round_robin", "knockout", "groups_knockout"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOGO = /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/;

function clean(input: TournamentInput) {
  const fe: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 2) fe.name = "Give the tournament a name.";
  if (!FORMATS.includes(input.format as Format)) fe.format = "Pick a format.";
  if (!DATE.test(input.startsOn)) fe.startsOn = "Pick the first day.";
  if (!DATE.test(input.endsOn)) fe.endsOn = "Pick the last day.";
  else if (DATE.test(input.startsOn) && input.endsOn < input.startsOn) fe.endsOn = "The last day can't be before the first.";
  const fee = input.fee.trim() ? Number(input.fee.replace(/[$,\s]/g, "")) : 0;
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000) fe.fee = "Enter an amount like 150.";
  const int = (v: string, d: number, lo: number, hi: number, key: string, msg: string) => {
    const x = v.trim() ? Number(v) : d;
    if (!Number.isInteger(x) || x < lo || x > hi) fe[key] = msg;
    return x;
  };
  const groupCount = int(input.groupCount, 2, 1, 16, "groupCount", "1 to 16 groups.");
  const advancePerGroup = int(input.advancePerGroup, 2, 1, 8, "advancePerGroup", "1 to 8 teams.");
  const maxTeams = input.maxTeams.trim() ? int(input.maxTeams, 0, 2, 128, "maxTeams", "2 to 128 teams.") : null;
  const pointsWin = int(input.pointsWin, 3, 0, 10, "pointsWin", "0 to 10.");
  const pointsDraw = int(input.pointsDraw, 1, 0, 10, "pointsDraw", "0 to 10.");
  const pointsLoss = int(input.pointsLoss, 0, -5, 10, "pointsLoss", "-5 to 10.");
  const lat = input.venueLat.trim() ? Number(input.venueLat) : null;
  const lng = input.venueLng.trim() ? Number(input.venueLng) : null;
  if (input.logo && (!LOGO.test(input.logo) || input.logo.length > 400_000)) fe.logo = "Use a PNG, JPG, WebP or SVG under 300 KB.";
  if (input.rules.length > 5000) fe.rules = "Keep the rules under 5,000 characters.";
  if (input.banner && (!BANNER.test(input.banner) || input.banner.length > BANNER_MAX_CHARS)) fe.banner = "Use a JPG, PNG or WebP image (it's shrunk for you; try a smaller one if this keeps happening).";
  const rosterMax = input.rosterMax.trim() ? int(input.rosterMax, 0, 1, 80, "rosterMax", "1 to 80 players.") : null;
  const rosterMin = input.rosterMin.trim() ? int(input.rosterMin, 0, 1, 80, "rosterMin", "1 to 80 players.") : null;
  if (rosterMax != null && rosterMin != null && rosterMin > rosterMax) fe.rosterMin = "Can't be more than the most players allowed.";
  if (input.rosterRules.length > 3000) fe.rosterRules = "Keep the criteria under 3,000 characters.";
  const dl = input.rosterDeadline.trim() ? new Date(input.rosterDeadline) : null;
  if (dl && Number.isNaN(dl.getTime())) fe.rosterDeadline = "Pick a date and time.";
  return {
    fe,
    data: {
      name,
      format: input.format as Format,
      legs: (input.legs === "2" ? 2 : 1) as 1 | 2,
      groupCount,
      advancePerGroup,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      venueName: input.venueName.trim() || null,
      venueAddress: input.venueAddress.trim() || null,
      venueLat: lat != null && Number.isFinite(lat) ? lat : null,
      venueLng: lng != null && Number.isFinite(lng) ? lng : null,
      rules: input.rules.trim() || null,
      feeCents: Math.round(fee * 100),
      payTo: input.payTo.trim() || null,
      maxTeams,
      pointsWin,
      pointsDraw,
      pointsLoss,
      isPublic: input.isPublic,
      registrationOpen: input.registrationOpen,
      rosterMax,
      rosterMin,
      rosterRules: input.rosterRules.trim() || null,
      rosterDeadline: dl && !Number.isNaN(dl.getTime()) ? dl.toISOString() : null,
    },
  };
}

const slugify = (s: string) =>
  `${s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40).replace(/^-|-$/g, "") || "cup"}-${randomUUID().slice(0, 4)}`;

export async function createTournament(input: TournamentInput): Promise<Result<{ id: string }>> {
  return caught(async () => {
    const clubs = await repo.clubsIRun();
    if (!clubs.some((c) => c.id === input.clubId)) return fail("Only a club's owner or admins can host a tournament.", { clubId: "Pick a club you run." });
    const { fe, data } = clean(input);
    if (Object.keys(fe).length) return fail("Check the highlighted fields.", fe);
    const t = await repo.insertTournament({
      ...data,
      clubId: input.clubId,
      slug: slugify(data.name),
      logo: input.logo ?? null,
      currency: "CAD",
      status: data.registrationOpen ? "registration" : "draft",
      bannerAt: null,
      createdBy: await repo.uid(),
    });
    if (input.banner) await repo.setBanner(t.id, input.banner);
    return { ok: true, data: { id: t.id } };
  });
}

async function asOrganizer(id: string): Promise<Tournament> {
  const t = await repo.tournament(id);
  if (!t) throw new Error("Tournament not found.");
  if (!(await repo.isOrganizer(t))) throw new Error("Only the tournament's organizers can do that.");
  return t;
}
async function asOfficial(id: string): Promise<Tournament> {
  const t = await repo.tournament(id);
  if (!t) throw new Error("Tournament not found.");
  if (!(await repo.isOfficial(t))) throw new Error("Only organizers and match officials can do that.");
  return t;
}

export async function updateTournament(id: string, input: TournamentInput): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(id);
    const { fe, data } = clean(input);
    if (Object.keys(fe).length) return fail("Check the highlighted fields.", fe);
    const fixturesExist = (await repo.matches(id)).length > 0;
    if (fixturesExist && (data.format !== t.format || data.legs !== t.legs || data.groupCount !== t.groupCount || data.advancePerGroup !== t.advancePerGroup))
      return fail("Fixtures are already made. Clear them on the Teams tab before changing the format.", { format: "Clear the fixtures first." });
    const moved =
      (data.venueName ?? null) !== (t.venueName ?? null) || (data.venueAddress ?? null) !== (t.venueAddress ?? null) || data.venueLat !== t.venueLat || data.venueLng !== t.venueLng;
    if (moved && venueLocked(t)) return fail("The tournament has started, so the location can't change any more.", { venueName: "Locked from the first day." });
    await repo.updateTournament(id, { ...data, ...(input.logo !== undefined ? { logo: input.logo } : {}) });
    if (input.banner !== undefined) await repo.setBanner(id, input.banner);
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

export async function setTournamentStatus(id: string, status: TournamentStatus): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    await repo.updateTournament(id, { status, ...(status === "in_progress" || status === "finished" ? { registrationOpen: false } : {}) });
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

export async function deleteTournament(id: string): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    await repo.deleteTournament(id);
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------

export async function inviteTeam(id: string, teamId: string, teamName: string): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(id);
    const entries = await repo.entries(id);
    const existing = entries.find((e) => e.teamId === teamId);
    if (existing && !["declined", "withdrawn"].includes(existing.status)) return fail(`${existing.name} is already on the list.`);
    if (existing) await repo.updateEntry(existing.id, { status: "invited" });
    else {
      if (t.maxTeams && entries.filter((e) => e.status === "accepted").length >= t.maxTeams) return fail(`The tournament is full (${t.maxTeams} teams).`);
      await repo.insertEntry({ tournamentId: id, teamId, name: teamName.slice(0, 80), status: "invited", paid: false, groupLabel: null, seed: null, apartSet: null, rosterSubmittedAt: null });
    }
    return { ok: true, data: undefined };
  });
}

export async function addGuestTeam(id: string, name: string, email: string): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    const n = name.trim();
    const fe: Record<string, string> = {};
    if (!n) fe.guestName = "Add the team's name.";
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) fe.guestEmail = "Enter an email like coach@gmail.com, or leave it blank.";
    if (Object.keys(fe).length) return fail("Check the highlighted fields.", fe);
    const entries = await repo.entries(id);
    if (entries.some((e) => !e.teamId && e.name.toLowerCase() === n.toLowerCase() && e.status !== "withdrawn")) return fail(`${n} is already on the list.`, { guestName: "Already added." });
    await repo.insertEntry({ tournamentId: id, teamId: null, name: n.slice(0, 80), status: "accepted", paid: false, groupLabel: null, seed: null, apartSet: null, rosterSubmittedAt: null }, email.trim().toLowerCase() || null);
    return { ok: true, data: undefined };
  });
}

export async function setEntry(id: string, entryId: string, patch: { status?: "accepted" | "declined"; paid?: boolean }): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(id);
    const e = (await repo.entries(id)).find((x) => x.id === entryId);
    if (!e) return fail("That team isn't in this tournament.");
    if (patch.status === "accepted" && t.maxTeams && (await repo.entries(id)).filter((x) => x.status === "accepted" && x.id !== entryId).length >= t.maxTeams)
      return fail(`The tournament is full (${t.maxTeams} teams).`);
    await repo.updateEntry(entryId, patch);
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

export async function removeEntry(id: string, entryId: string): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    const playing = (await repo.matches(id)).some((m) => (m.homeId === entryId || m.awayId === entryId) && m.status === "finished");
    if (playing) return fail("This team has played. Clear the fixtures first, or leave them in.");
    await repo.deleteEntry(entryId);
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

export async function respondInvite(entryId: string, accept: boolean): Promise<Result> {
  return caught(async () => {
    await repo.respondInvite(entryId, accept);
    const mine = await repo.entriesForTeams((await repo.teamsIRun()).map((x) => x.id));
    const tid = mine.find((x) => x.id === entryId)?.tournamentId;
    if (tid) await syncCalendars(tid);
    return { ok: true, data: undefined };
  });
}

export async function applyToTournament(id: string, teamId: string): Promise<Result> {
  return caught(async () => {
    await repo.apply(id, teamId);
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

export async function withdrawEntry(entryId: string): Promise<Result> {
  return caught(async () => {
    await repo.withdraw(entryId);
    const mine = await repo.entriesForTeams((await repo.teamsIRun()).map((x) => x.id));
    const tid = mine.find((x) => x.id === entryId)?.tournamentId;
    if (tid) await syncCalendars(tid);
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// fixtures and results
// ---------------------------------------------------------------------------

export async function generateFixtures(id: string, opts: { random: boolean; replace: boolean }): Promise<Result<{ count: number }>> {
  return caught(async () => {
    const t = await asOrganizer(id);
    const existing = await repo.matches(id);
    if (existing.some((m) => m.status === "finished" && !(m.homeSource === "BYE" || m.awaySource === "BYE")) && !opts.replace)
      return fail("Some results are already in. Tick “Start over” to replace every fixture and result.");
    const accepted = (await repo.entries(id)).filter((e) => e.status === "accepted");
    if (accepted.length < 2) return fail("You need at least 2 teams in. Accept some teams first.");
    if (t.format === "groups_knockout" && accepted.length < t.groupCount * 2) return fail(`${t.groupCount} groups need at least ${t.groupCount * 2} teams. Use fewer groups or add teams.`);
    // The host's seeding (unseeded teams after, in the order they joined), or a random draw.
    // A random draw doesn't change the published seeds. Keep-apart sets apply either way.
    const order = opts.random ? shuffle(accepted) : seedOrder(accepted);
    const drawn = order.map((e, i) => ({ ...e, drawSeed: i + 1 }));
    let made;
    try {
      made = engineFixtures(
        { format: t.format, legs: t.legs, groupCount: t.groupCount, advancePerGroup: t.advancePerGroup },
        drawn.map((e) => ({ id: e.id, name: e.name, seed: e.drawSeed, groupLabel: null, apartSet: e.apartSet })),
        randomUUID,
      );
    } catch (err) {
      return fail((err as Error).message);
    }
    const { matches, groups } = made;
    for (const e of drawn) {
      const patch: Partial<Entry> = { groupLabel: groups[e.id] ?? null };
      if (!opts.random) patch.seed = e.drawSeed;
      if (patch.groupLabel !== e.groupLabel || (patch.seed != null && patch.seed !== e.seed)) await repo.updateEntry(e.id, patch);
    }
    // Spread rounds over the tournament's days, one round per day when there are enough.
    const days = Math.max(1, Math.round((Date.parse(t.endsOn) - Date.parse(t.startsOn)) / 86_400_000) + 1);
    const rounds = Math.max(...matches.map((m) => m.round));
    const full: Match[] = matches.map((m) => ({
      ...m,
      tournamentId: id,
      kickoffAt: null,
      pitch: null,
      homeScore: null,
      awayScore: null,
      homePens: null,
      awayPens: null,
      winnerId: null,
      motmRosterId: null,
      roundName: m.roundName,
      // Keep a date hint in the round name only; times are set per match.
      ...(days > 1 && rounds > 1 ? {} : {}),
    }));
    await repo.replaceMatches(id, full);
    await settle(t);
    if (t.status === "draft" || t.status === "registration") await repo.updateTournament(id, { status: "in_progress", registrationOpen: false });
    await syncCalendars(id);
    return { ok: true, data: { count: full.filter((m) => !(m.homeSource === "BYE" || m.awaySource === "BYE")).length } };
  });
}

export async function clearFixtures(id: string): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(id);
    await repo.replaceMatches(id, []);
    for (const e of await repo.entries(id)) if (e.groupLabel) await repo.updateEntry(e.id, { groupLabel: null });
    if (t.status === "in_progress" || t.status === "finished") await repo.updateTournament(id, { status: "registration" });
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

function seedOrder<T extends Entry>(es: T[]): T[] {
  return [...es].sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
}
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The host sets the seeding (1 = top seed) and which teams are kept apart in the group draw.
 * Everyone can see both. Locked once fixtures are made, so the draw matches what was published.
 */
export async function saveSeeding(id: string, order: string[], apart: Record<string, number | null>): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(id);
    if ((await repo.matches(id)).length) return fail("Fixtures are made. Clear the fixtures to change the seeding.");
    const accepted = (await repo.entries(id)).filter((e) => e.status === "accepted");
    const known = new Set(accepted.map((e) => e.id));
    const ids = [...new Set(order.filter((x) => known.has(x)))];
    for (const e of seedOrder(accepted)) if (!ids.includes(e.id)) ids.push(e.id);
    const sets = new Map<number, number>();
    for (const e of accepted) {
      const s = apart[e.id] ?? null;
      if (s != null && (!Number.isInteger(s) || s < 1 || s > 9)) return fail("Pick a keep-apart set from 1 to 9.");
      if (s != null) sets.set(s, (sets.get(s) ?? 0) + 1);
    }
    if (t.format === "groups_knockout")
      for (const [s, c] of sets)
        if (c > t.groupCount) return fail(`Set ${s} has ${c} teams but there are only ${t.groupCount} groups, so they can't all be kept apart.`);
    for (const [s, c] of sets) if (c < 2) return fail(`Set ${s} has only one team. Put at least 2 teams in a set, or clear it.`);
    for (const [i, eid] of ids.entries()) {
      const e = accepted.find((x) => x.id === eid)!;
      const patch = { seed: i + 1, apartSet: apart[eid] ?? null };
      if (patch.seed !== e.seed || patch.apartSet !== e.apartSet) await repo.updateEntry(eid, patch);
    }
    return { ok: true, data: undefined };
  });
}

/** Re-work brackets and winners from the results, and finish the tournament when there's a champion. */
async function settle(t: Tournament) {
  const [entries, matches] = await Promise.all([repo.entries(t.id), repo.matches(t.id)]);
  const accepted = entries.filter((e) => e.status === "accepted").map((e) => ({ id: e.id, name: e.name, seed: e.seed, groupLabel: e.groupLabel }));
  const pts = { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss };
  const changed = resolveTournament(accepted, matches, pts);
  if (changed.length) {
    await repo.updateMatches(changed.map((m) => ({ id: m.id, homeId: m.homeId, awayId: m.awayId, winnerId: m.winnerId, status: m.status })));
    for (const c of changed) Object.assign(matches.find((m) => m.id === c.id)!, c);
  }
  const champ = champion(accepted, matches, t.format, pts);
  if (champ && t.status !== "finished") await repo.updateTournament(t.id, { status: "finished" });
  if (!champ && t.status === "finished") await repo.updateTournament(t.id, { status: "in_progress" });
}

export interface ResultInput {
  status: string;
  homeScore: string;
  awayScore: string;
  homePens: string;
  awayPens: string;
  kickoffAt: string;
  pitch: string;
}

export async function saveResult(id: string, matchId: string, input: ResultInput): Promise<Result> {
  return caught(async () => {
    const t = await asOfficial(id);
    const m = (await repo.matches(id)).find((x) => x.id === matchId);
    if (!m) return fail("That match isn't in this tournament.");
    const fe: Record<string, string> = {};
    const status = (["scheduled", "live", "finished", "postponed", "cancelled"].includes(input.status) ? input.status : "scheduled") as Match["status"];
    const num = (v: string, key: string, max: number) => {
      if (!v.trim()) return null;
      const x = Number(v);
      if (!Number.isInteger(x) || x < 0 || x > max) fe[key] = `0 to ${max}.`;
      return x;
    };
    const hs = num(input.homeScore, "homeScore", 999);
    const as = num(input.awayScore, "awayScore", 999);
    let hp = num(input.homePens, "homePens", 99);
    let ap = num(input.awayPens, "awayPens", 99);
    if ((status === "finished" || status === "live") && (hs == null || as == null)) fe.homeScore = "Enter both scores.";
    if (status === "finished" && (!m.homeId || !m.awayId)) return fail("Both teams need to be known before this match can finish.");
    if (m.stage === "knockout" && status === "finished" && hs != null && hs === as) {
      if (hp == null || ap == null || hp === ap) fe.homePens = "Knockout games can't end level: add the penalty shoot-out score.";
    } else {
      hp = null;
      ap = null;
    }
    const kickoff = input.kickoffAt.trim() ? new Date(input.kickoffAt) : null;
    if (kickoff && Number.isNaN(kickoff.getTime())) fe.kickoffAt = "Pick a date and time.";
    if (Object.keys(fe).length) return fail("Check the highlighted fields.", fe);
    await repo.updateMatches([
      { id: matchId, status, homeScore: hs, awayScore: as, homePens: hp, awayPens: ap, kickoffAt: kickoff ? kickoff.toISOString() : null, pitch: input.pitch.trim().slice(0, 60) || null },
    ]);
    await settle(t);
    await syncCalendars(id);
    return { ok: true, data: undefined };
  });
}

export async function addMatchEvent(id: string, matchId: string, input: { entryId: string; kind: string; minute: string; player: string }): Promise<Result> {
  return caught(async () => {
    await asOfficial(id);
    const m = (await repo.matches(id)).find((x) => x.id === matchId);
    if (!m) return fail("That match isn't in this tournament.");
    if (input.entryId !== m.homeId && input.entryId !== m.awayId) return fail("Pick one of the two teams.");
    const kinds: EventKind[] = ["goal", "penalty_goal", "own_goal", "yellow", "red"];
    if (!kinds.includes(input.kind as EventKind)) return fail("Pick what happened.");
    const minute = input.minute.trim() ? Number(input.minute) : null;
    if (minute != null && (!Number.isInteger(minute) || minute < 0 || minute > 200)) return fail("Minute is 0 to 200.", { minute: "0 to 200." });
    await repo.insertEvent({ matchId, entryId: input.entryId, kind: input.kind as EventKind, minute, player: input.player.trim().slice(0, 60) || null });
    return { ok: true, data: undefined };
  });
}

export async function removeMatchEvent(id: string, eventId: string): Promise<Result> {
  return caught(async () => {
    await asOfficial(id);
    await repo.deleteEvent(eventId);
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// officials
// ---------------------------------------------------------------------------

export async function addOfficial(id: string, email: string, role: OfficialRole): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return fail("Enter their email.", { officialEmail: "Enter an email like ref@gmail.com." });
    const userId = await repo.userIdByEmail(e);
    if (!userId) return fail("Nobody on Clbx uses that email yet. Ask them to sign up first, then add them.", { officialEmail: "No Clbx account with this email." });
    await repo.addOfficial(id, userId, role);
    return { ok: true, data: undefined };
  });
}

export async function removeOfficial(id: string, userId: string): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    await repo.removeOfficial(id, userId);
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// rosters: the host sets limits and criteria; each team lists players (with numbers),
// a manager and a coach, then submits. After that only the host can change it, and every
// host change is marked on the roster for everyone to see.
// ---------------------------------------------------------------------------

export interface RosterView {
  t: Tournament;
  entry: Entry & { crestUrl: string | null };
  people: RosterPerson[];
  isHost: boolean;
  isTeamStaff: boolean;
  /** The team itself can still change it. */
  teamCanEdit: boolean;
  /** Whoever is looking can change it (team while open, host any time). */
  canEdit: boolean;
  /** Why the team can't change it any more, if it can't. */
  lockReason: string | null;
  /** When the team's roster closes: the host's deadline or the team's first kick-off. */
  closesAt: string | null;
  players: number;
  hostChanges: number;
  /** Players on the Clbx team who aren't on the roster yet, to add with one tap. */
  pickable: { userId: string | null; name: string; jersey: number | null }[];
}

function rosterWindow(t: Tournament, e: Entry, matches: Match[]) {
  const mine = matches.filter((m) => (m.homeId === e.id || m.awayId === e.id) && m.homeSource !== "BYE" && m.awaySource !== "BYE");
  const kicks = mine.map((m) => m.kickoffAt).filter((x): x is string => !!x).sort();
  const started = mine.some((m) => m.status === "live" || m.status === "finished") || (kicks[0] != null && Date.parse(kicks[0]) <= Date.now());
  const closesAt = [t.rosterDeadline, kicks[0] ?? null].filter((x): x is string => !!x).sort()[0] ?? null;
  let lockReason: string | null = null;
  if (e.rosterSubmittedAt) lockReason = "Submitted. Only the host can change it now.";
  else if (t.status === "finished") lockReason = "The tournament is over.";
  else if (started) lockReason = "Your first game has started, so the roster is closed. Ask the host for changes.";
  else if (t.rosterDeadline && Date.parse(t.rosterDeadline) <= Date.now()) lockReason = "The roster deadline has passed. Ask the host for changes.";
  return { closesAt, lockReason };
}

async function rosterAccess(tid: string, entryId: string) {
  const t = await repo.tournament(tid);
  if (!t) throw new Error("Tournament not found.");
  const [entries, matches, isHost, myTeams] = await Promise.all([repo.entries(t.id), repo.matches(t.id), repo.isOrganizer(t), repo.teamsIRun()]);
  const e = entries.find((x) => x.id === entryId);
  if (!e || e.status !== "accepted") throw new Error("That team isn't in this tournament.");
  const isTeamStaff = !!e.teamId && myTeams.some((x) => x.id === e.teamId);
  const { closesAt, lockReason } = rosterWindow(t, e, matches);
  const teamCanEdit = isTeamStaff && !lockReason;
  return { t, e, isHost, isTeamStaff, teamCanEdit, canEdit: isHost || teamCanEdit, closesAt, lockReason };
}

export async function getRoster(tid: string, entryId: string): Promise<RosterView | null> {
  const t = await repo.tournament(tid);
  if (!t) return null;
  let a;
  try {
    a = await rosterAccess(t.id, entryId);
  } catch {
    return null;
  }
  if (!a.isHost && !a.isTeamStaff && !(await repo.isParticipant(t))) return null;
  const people = (await repo.roster(t.id)).filter((p) => p.entryId === entryId);
  const active = people.filter((p) => p.hostChange !== "removed");
  const refs = a.e.teamId ? await repo.teamRefs([a.e.teamId]) : new Map();
  let pickable: RosterView["pickable"] = [];
  if (a.canEdit && a.e.teamId && a.isTeamStaff) {
    const on = new Set(active.map((p) => p.userId).filter(Boolean));
    pickable = (await repo.teamPlayers(a.e.teamId)).filter((p) => !p.userId || !on.has(p.userId)).sort((x, y) => x.name.localeCompare(y.name));
  }
  const order: Record<RosterRole, number> = { manager: 0, coach: 1, player: 2 };
  return {
    t,
    entry: { ...a.e, crestUrl: a.e.teamId ? crestUrl(a.e.teamId, refs.get(a.e.teamId)?.crest) : null },
    people: people.sort((x, y) => order[x.role] - order[y.role] || (x.jersey ?? 1e4) - (y.jersey ?? 1e4) || x.name.localeCompare(y.name)),
    isHost: a.isHost,
    isTeamStaff: a.isTeamStaff,
    teamCanEdit: a.teamCanEdit,
    canEdit: a.canEdit,
    lockReason: a.lockReason,
    closesAt: a.closesAt,
    players: active.filter((p) => p.role === "player").length,
    hostChanges: people.filter((p) => p.hostChange).length,
    pickable,
  };
}

/** Roster status of every team, for the Teams tab. null when you can't see rosters. */
export async function rosterStatuses(tid: string): Promise<Record<string, { submittedAt: string | null; players: number; hostChanges: number }> | null> {
  const t = await repo.tournament(tid);
  if (!t || !(await repo.isParticipant(t))) return null;
  const [entries, people] = await Promise.all([repo.entries(t.id), repo.roster(t.id)]);
  const out: Record<string, { submittedAt: string | null; players: number; hostChanges: number }> = {};
  for (const e of entries.filter((x) => x.status === "accepted")) {
    const mine = people.filter((p) => p.entryId === e.id);
    out[e.id] = {
      submittedAt: e.rosterSubmittedAt,
      players: mine.filter((p) => p.role === "player" && p.hostChange !== "removed").length,
      hostChanges: mine.filter((p) => p.hostChange).length,
    };
  }
  return out;
}

export interface RosterInput {
  role: string;
  name: string;
  jersey: string;
  userId?: string | null;
}

function cleanPerson(input: RosterInput, others: RosterPerson[], selfId: string | null) {
  const fe: Record<string, string> = {};
  const role = (["player", "manager", "coach"] as const).find((r) => r === input.role);
  if (!role) fe.role = "Pick player, manager or coach.";
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) fe.name = "Enter their name.";
  else if (name.length > 80) fe.name = "Keep the name under 80 characters.";
  let jersey: number | null = null;
  if (role === "player") {
    const j = input.jersey.trim();
    if (!/^\d{1,3}$/.test(j)) fe.jersey = "Enter their jersey number.";
    else {
      jersey = Number(j);
      const clash = others.find((p) => p.id !== selfId && p.role === "player" && p.hostChange !== "removed" && p.jersey === jersey);
      if (clash) fe.jersey = `#${jersey} is already ${clash.name}'s number.`;
    }
  }
  if (role === "manager" || role === "coach") {
    const taken = others.find((p) => p.id !== selfId && p.role === role && p.hostChange !== "removed");
    if (taken) fe.role = `${taken.name} is already the ${role}. Remove them first, or change their name.`;
  }
  return { fe, data: role ? { role, name, jersey } : null };
}

export async function addRosterPeople(tid: string, entryId: string, inputs: RosterInput[]): Promise<Result<{ added: number }>> {
  return caught(async () => {
    const a = await rosterAccess(tid, entryId);
    if (!a.canEdit) return fail(a.lockReason ?? "Only the team's captains and managers, or the host, can change this roster.");
    const people = (await repo.roster(a.t.id)).filter((p) => p.entryId === entryId);
    let players = people.filter((p) => p.role === "player" && p.hostChange !== "removed").length;
    let added = 0;
    for (const input of inputs) {
      const { fe, data } = cleanPerson(input, people, null);
      if (Object.keys(fe).length || !data) return inputs.length > 1 ? fail(`${input.name.trim() || "A player"}: ${Object.values(fe)[0]}`) : fail(Object.values(fe)[0], fe);
      if (data.role === "player" && a.t.rosterMax != null && players >= a.t.rosterMax) return fail(`This tournament allows ${a.t.rosterMax} players per team.${added ? ` Added ${added}.` : ""}`);
      if (input.userId && people.some((p) => p.userId === input.userId && p.hostChange !== "removed")) continue;
      await repo.insertRosterPerson({ tournamentId: a.t.id, entryId, role: data.role, name: data.name, jersey: data.jersey, userId: input.userId ?? null });
      people.push({ id: `new-${added}`, tournamentId: a.t.id, entryId, role: data.role, name: data.name, jersey: data.jersey, userId: input.userId ?? null, isCaptain: false, hostChange: null, hostChangedAt: null, prevName: null, prevJersey: null, prevCaptain: null, createdAt: "" });
      if (data.role === "player") players++;
      added++;
    }
    return { ok: true, data: { added } };
  });
}

export async function editRosterPerson(tid: string, entryId: string, personId: string, input: { name: string; jersey: string }): Promise<Result> {
  return caught(async () => {
    const a = await rosterAccess(tid, entryId);
    if (!a.canEdit) return fail(a.lockReason ?? "You can't change this roster.");
    const people = (await repo.roster(a.t.id)).filter((p) => p.entryId === entryId);
    const p = people.find((x) => x.id === personId);
    if (!p || p.hostChange === "removed") return fail("They aren't on this roster.");
    const { fe, data } = cleanPerson({ role: p.role, name: input.name, jersey: input.jersey }, people, p.id);
    if (Object.keys(fe).length || !data) return fail(Object.values(fe)[0], fe);
    await repo.updateRosterPerson(p.id, { name: data.name, jersey: data.jersey });
    return { ok: true, data: undefined };
  });
}

export async function removeRosterPerson(tid: string, entryId: string, personId: string): Promise<Result> {
  return caught(async () => {
    const a = await rosterAccess(tid, entryId);
    if (!a.canEdit) return fail(a.lockReason ?? "You can't change this roster.");
    const p = (await repo.roster(a.t.id)).find((x) => x.id === personId && x.entryId === entryId);
    if (!p || p.hostChange === "removed") return fail("They aren't on this roster.");
    await repo.deleteRosterPerson(p.id);
    return { ok: true, data: undefined };
  });
}

export async function setRosterCaptain(tid: string, entryId: string, personId: string | null): Promise<Result> {
  return caught(async () => {
    const a = await rosterAccess(tid, entryId);
    if (!a.canEdit) return fail(a.lockReason ?? "You can't change this roster.");
    if (personId) {
      const p = (await repo.roster(a.t.id)).find((x) => x.id === personId && x.entryId === entryId);
      if (!p || p.hostChange === "removed" || p.role !== "player") return fail("Pick a player on this roster.");
    }
    await repo.setCaptain(entryId, personId);
    return { ok: true, data: undefined };
  });
}

export async function submitRoster(tid: string, entryId: string, confirmed: boolean): Promise<Result> {
  return caught(async () => {
    const a = await rosterAccess(tid, entryId);
    if (a.e.rosterSubmittedAt) return fail("This roster is already submitted.");
    if (!a.canEdit) return fail(a.lockReason ?? "Only the team's captains and managers, or the host, can submit this roster.");
    if (a.t.rosterRules && !confirmed) return fail("Tick the box to confirm your roster meets the tournament's criteria.", { confirm: "Required." });
    const players = (await repo.roster(a.t.id)).filter((p) => p.entryId === entryId && p.role === "player" && p.hostChange !== "removed").length;
    const min = Math.max(1, a.t.rosterMin ?? 1);
    if (players < min) return fail(`Add at least ${min} player${min === 1 ? "" : "s"} before submitting.`);
    if (a.t.rosterMax != null && players > a.t.rosterMax) return fail(`This tournament allows ${a.t.rosterMax} players per team.`);
    await repo.submitRoster(entryId);
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// team calendars: a team that's in a tournament gets the tournament, and each of its games
// once the game has a time, on its own calendar. Re-worked from the tournament after every
// change; never fails the change itself.
// ---------------------------------------------------------------------------

const CAL_TZ = "America/Toronto";
const GAME_MINUTES = 60;

function localIso(date: string, time: string) {
  // date + wall-clock time in Toronto → UTC ISO.
  const guess = Date.parse(`${date}T${time}:00Z`);
  const off = (d: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CAL_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(d));
    const g = (k: string) => Number(parts.find((x) => x.type === k)!.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - d;
  };
  return new Date(guess - off(guess - off(guess))).toISOString();
}

export function calendarFor(t: Tournament, entries: Entry[], matches: Match[], link: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const name = (id: string | null) => entries.find((e) => e.id === id)?.name ?? null;
  const where = [t.venueName, t.venueAddress].filter(Boolean).join(", ") || null;
  for (const e of entries.filter((x) => x.status === "accepted" && x.teamId)) {
    const games = matches.filter((m) => (m.homeId === e.id || m.awayId === e.id) && m.homeId && m.awayId && m.homeSource !== "BYE" && m.awaySource !== "BYE");
    const timed = games.filter((m) => m.kickoffAt).sort((a, b) => a.kickoffAt!.localeCompare(b.kickoffAt!));
    const first = timed[0]?.kickoffAt;
    const last = timed[timed.length - 1]?.kickoffAt;
    const untimed = games.length - timed.length;
    // The tournament's days, stretched to cover any game timed outside them.
    const start = Math.min(Date.parse(localIso(t.startsOn, "09:00")), first ? Date.parse(first) : Infinity);
    const end = Math.max(Date.parse(localIso(t.endsOn, "17:00")), last ? Date.parse(last) + GAME_MINUTES * 60_000 : -Infinity, start + 3_600_000);
    const span = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
    out.push({
      teamId: e.teamId!,
      tournamentMatchId: null,
      type: "tournament",
      title: t.name,
      startAt: span.start,
      endAt: span.end,
      locationText: where,
      opponent: null,
      notes: [
        `${e.name} is in this tournament.`,
        games.length ? `${games.length} ${games.length === 1 ? "game" : "games"} so far${untimed ? `, ${untimed} still without a time (they show here once the host sets one)` : ""}.` : "Games show here once the fixtures are made.",
        `Fixtures, results and the table: ${link}`,
      ].join(" "),
      status: "active",
    });
    for (const m of timed) {
      const opp = name(m.homeId === e.id ? m.awayId : m.homeId);
      out.push({
        teamId: e.teamId!,
        tournamentMatchId: m.id,
        type: "match",
        title: `${t.name} · ${m.roundName ?? `Round ${m.round}`}`,
        startAt: m.kickoffAt!,
        endAt: new Date(Date.parse(m.kickoffAt!) + GAME_MINUTES * 60_000).toISOString(),
        locationText: [m.pitch, t.venueName].filter(Boolean).join(" · ") || where,
        opponent: opp,
        notes: `Tournament game. Results and the table: ${link}`,
        status: m.status === "postponed" ? "postponed" : m.status === "cancelled" ? "cancelled" : "active",
      });
    }
  }
  return out;
}

async function syncCalendars(tid: string) {
  try {
    const t = await repo.tournament(tid);
    if (!t) return;
    const [entries, matches] = await Promise.all([repo.entries(t.id), repo.matches(t.id)]);
    const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://clbx.ca";
    await repo.syncCalendar(t.id, calendarFor(t, entries, matches, `${site.replace(/\/$/, "")}/tournaments/${t.id}`));
  } catch (e) {
    console.error("[tournaments] team calendars:", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// honours: tournaments a team won or finished second in, for its achievements wall
// ---------------------------------------------------------------------------

export interface Honour {
  place: "champions" | "runners_up";
  tournamentId: string;
  name: string;
  hostedBy: string | null;
  year: string;
  endsOn: string;
  logoUrl: string | null;
}

export async function teamHonours(teamId: string): Promise<Honour[]> {
  try {
    const mine = (await repo.entriesForTeams([teamId])).filter((e) => e.status === "accepted");
    const ts = await repo.tournamentsByIds([...new Set(mine.map((e) => e.tournamentId))]);
    const out: Honour[] = [];
    for (const t of ts.filter((x) => x.status === "finished")) {
      const [entries, matches, host] = await Promise.all([repo.entries(t.id), repo.matches(t.id), repo.clubName(t.clubId)]);
      const es = entries.filter((e) => e.status === "accepted").map((e) => ({ id: e.id, name: e.name, seed: e.seed, groupLabel: e.groupLabel }));
      const pts = { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss };
      const me = mine.find((e) => e.tournamentId === t.id)!;
      const place = champion(es, matches, t.format, pts) === me.id ? "champions" : runnerUp(es, matches, t.format, pts) === me.id ? "runners_up" : null;
      if (place) out.push({ place, tournamentId: t.id, name: t.name, hostedBy: host, year: t.endsOn.slice(0, 4), endsOn: t.endsOn, logoUrl: tournamentLogoUrl(t) });
    }
    return out.sort((a, b) => b.endsOn.localeCompare(a.endsOn) || (a.place === "champions" ? -1 : 1));
  } catch (e) {
    console.error("[tournaments] honours:", (e as Error).message);
    return [];
  }
}

/** Logos for tournaments that put events on calendars, for the event cards. */
export async function tournamentBadges(ids: (string | null | undefined)[]): Promise<Record<string, { name: string; logoUrl: string | null; bannerUrl: string | null }>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return {};
  try {
    const ts = await repo.tournamentsByIds(want);
    return Object.fromEntries(ts.map((t) => [t.id, { name: t.name, logoUrl: tournamentLogoUrl(t), bannerUrl: tournamentBannerUrl(t) }]));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// player of the match and awards
// ---------------------------------------------------------------------------

/** Players on both teams' rosters, to pick a player of the match. */
export async function motmChoices(tid: string, matchId: string) {
  const t = await repo.tournament(tid);
  if (!t || !(await repo.isOfficial(t))) return null;
  const m = (await repo.matches(t.id)).find((x) => x.id === matchId);
  if (!m?.homeId || !m.awayId) return null;
  const entries = await repo.entries(t.id);
  const people = (await repo.roster(t.id)).filter((p) => (p.entryId === m.homeId || p.entryId === m.awayId) && p.role === "player" && p.hostChange !== "removed");
  return [m.homeId, m.awayId].map((eid) => ({
    entryId: eid,
    team: entries.find((e) => e.id === eid)?.name ?? "",
    players: people.filter((p) => p.entryId === eid).sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999)).map((p) => ({ id: p.id, name: p.name, jersey: p.jersey })),
  }));
}

export async function setMatchMotm(tid: string, matchId: string, rosterId: string | null): Promise<Result> {
  return caught(async () => {
    const t = await asOfficial(tid);
    const m = (await repo.matches(t.id)).find((x) => x.id === matchId);
    if (!m) return fail("That game isn't in this tournament.");
    if (rosterId) {
      const p = (await repo.roster(t.id)).find((x) => x.id === rosterId);
      if (!p || p.role !== "player" || p.hostChange === "removed" || (p.entryId !== m.homeId && p.entryId !== m.awayId)) return fail("Pick a player from one of the two teams.");
    }
    await repo.updateMatches([{ id: m.id, motmRosterId: rosterId }]);
    return { ok: true, data: undefined };
  });
}

/** Everyone the host could give an award to: each team, and the players on its roster. */
export async function awardChoices(tid: string) {
  const t = await repo.tournament(tid);
  if (!t || !(await repo.isOrganizer(t))) return null;
  const [entries, people] = await Promise.all([repo.entries(t.id), repo.roster(t.id)]);
  return entries
    .filter((e) => e.status === "accepted")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({
      entryId: e.id,
      team: e.name,
      players: people.filter((p) => p.entryId === e.id && p.role === "player" && p.hostChange !== "removed").sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999)).map((p) => ({ id: p.id, name: p.name, jersey: p.jersey })),
    }));
}

export async function addAward(tid: string, input: { title: string; entryId: string; rosterId: string; note: string }): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(tid);
    const title = input.title.trim().replace(/\s+/g, " ");
    const fe: Record<string, string> = {};
    if (!title) fe.title = "Name the award, e.g. Best player.";
    else if (title.length > 60) fe.title = "Keep it under 60 characters.";
    const entries = await repo.entries(t.id);
    const entry = entries.find((e) => e.id === input.entryId && e.status === "accepted");
    if (!entry) fe.entryId = "Pick the team.";
    let rosterId: string | null = null;
    if (entry && input.rosterId) {
      const p = (await repo.roster(t.id)).find((x) => x.id === input.rosterId);
      if (!p || p.entryId !== entry.id || p.hostChange === "removed") fe.rosterId = "Pick a player from that team.";
      else rosterId = p.id;
    }
    if (Object.keys(fe).length) return fail(Object.values(fe)[0], fe);
    const existing = await repo.awards(t.id);
    await repo.insertAward({ tournamentId: t.id, title, entryId: entry!.id, rosterId, note: input.note.trim().slice(0, 120) || null, sort: existing.length });
    return { ok: true, data: undefined };
  });
}

export async function removeAward(tid: string, awardId: string): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(tid);
    if (!(await repo.awards(t.id)).some((a) => a.id === awardId)) return fail("That award isn't in this tournament.");
    await repo.deleteAward(awardId);
    return { ok: true, data: undefined };
  });
}

/** A Clbx player's tournament honours, for the badges on their profile. */
export async function playerHonours(userId: string): Promise<{ motm: { tournament: string; tournamentId: string; game: string }[]; awards: { title: string; tournament: string; tournamentId: string; year: string }[] }> {
  try {
    const h = await repo.honoursFor(userId);
    const ids = [...new Set([...h.motm.map((m) => m.tournamentId), ...h.awards.map((a) => a.tournamentId)])];
    const ts = new Map((await repo.tournamentsByIds(ids)).map((t) => [t.id, t]));
    return {
      motm: h.motm.filter((m) => ts.has(m.tournamentId)).map((m) => ({ tournament: ts.get(m.tournamentId)!.name, tournamentId: m.tournamentId, game: m.roundName ?? `Round ${m.round}` })),
      awards: h.awards
        .filter((a) => ts.has(a.tournamentId))
        .map((a) => ({ title: a.title, tournament: ts.get(a.tournamentId)!.name, tournamentId: a.tournamentId, year: ts.get(a.tournamentId)!.endsOn.slice(0, 4) })),
    };
  } catch (e) {
    console.error("[tournaments] player honours:", (e as Error).message);
    return { motm: [], awards: [] };
  }
}
