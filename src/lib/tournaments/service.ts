import "server-only";
import { randomUUID } from "node:crypto";
import { LIVE } from "../mode";
import { crestUrl } from "../images";
import { memoryRepo } from "./repo-memory";
import { supabaseRepo } from "./repo-supabase";
import type { Repo } from "./repo";
import { champion, describeSource, generateFixtures as engineFixtures, resolveTournament, standings, type EngineEntry, type Format, type StandingRow } from "./engine";
import type { Entry, EventKind, Match, MatchEvent, Official, OfficialRole, Tournament, TournamentStatus } from "./types";

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
}

export interface TournamentView {
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
  const mv: MatchView[] = matches
    .sort((a, b) => a.round - b.round || (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") || a.slot - b.slot)
    .map((m) => ({
      ...m,
      home: side(m.homeId),
      away: side(m.awayId),
      homeLabel: side(m.homeId)?.name ?? describeSource(m.homeSource, matches),
      awayLabel: side(m.awayId)?.name ?? describeSource(m.awaySource, matches),
      events: events.filter((x) => x.matchId === m.id),
    }));
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
    clubName,
    role,
    entries: ev,
    matches: mv,
    tables,
    championId: champion(engineEntries, matches, t.format, pts),
    officials,
    canApplyWith: t.registrationOpen && t.isPublic && ["draft", "registration"].includes(t.status) ? myTeams.filter((x) => !entered.has(x.id)).map((x) => ({ id: x.id, name: x.name })) : [],
    signedIn: !!uid,
  };
}

export async function tournamentLogo(id: string): Promise<string | null> {
  return (await repo.tournament(id))?.logo ?? null;
}

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
      createdBy: await repo.uid(),
    });
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
    await repo.updateTournament(id, { ...data, ...(input.logo !== undefined ? { logo: input.logo } : {}) });
    return { ok: true, data: undefined };
  });
}

export async function setTournamentStatus(id: string, status: TournamentStatus): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    await repo.updateTournament(id, { status, ...(status === "in_progress" || status === "finished" ? { registrationOpen: false } : {}) });
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
      await repo.insertEntry({ tournamentId: id, teamId, name: teamName.slice(0, 80), status: "invited", paid: false, groupLabel: null, seed: null, apartSet: null });
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
    await repo.insertEntry({ tournamentId: id, teamId: null, name: n.slice(0, 80), status: "accepted", paid: false, groupLabel: null, seed: null, apartSet: null }, email.trim().toLowerCase() || null);
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
    return { ok: true, data: undefined };
  });
}

export async function removeEntry(id: string, entryId: string): Promise<Result> {
  return caught(async () => {
    await asOrganizer(id);
    const playing = (await repo.matches(id)).some((m) => (m.homeId === entryId || m.awayId === entryId) && m.status === "finished");
    if (playing) return fail("This team has played. Clear the fixtures first, or leave them in.");
    await repo.deleteEntry(entryId);
    return { ok: true, data: undefined };
  });
}

export async function respondInvite(entryId: string, accept: boolean): Promise<Result> {
  return caught(async () => {
    await repo.respondInvite(entryId, accept);
    return { ok: true, data: undefined };
  });
}

export async function applyToTournament(id: string, teamId: string): Promise<Result> {
  return caught(async () => {
    await repo.apply(id, teamId);
    return { ok: true, data: undefined };
  });
}

export async function withdrawEntry(entryId: string): Promise<Result> {
  return caught(async () => {
    await repo.withdraw(entryId);
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
      roundName: m.roundName,
      // Keep a date hint in the round name only; times are set per match.
      ...(days > 1 && rounds > 1 ? {} : {}),
    }));
    await repo.replaceMatches(id, full);
    await settle(t);
    if (t.status === "draft" || t.status === "registration") await repo.updateTournament(id, { status: "in_progress", registrationOpen: false });
    return { ok: true, data: { count: full.filter((m) => !(m.homeSource === "BYE" || m.awaySource === "BYE")).length } };
  });
}

export async function clearFixtures(id: string): Promise<Result> {
  return caught(async () => {
    const t = await asOrganizer(id);
    await repo.replaceMatches(id, []);
    for (const e of await repo.entries(id)) if (e.groupLabel) await repo.updateEntry(e.id, { groupLabel: null });
    if (t.status === "in_progress" || t.status === "finished") await repo.updateTournament(id, { status: "registration" });
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
