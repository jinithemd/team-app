/*
 * Tournament engine: fixtures, standings and knockout progression. Pure functions only,
 * shared by the sample and Supabase builds and by the public page.
 *
 * Knockout slots don't store "who's in" as the truth: they store where the team comes
 * from (home_source/away_source: "A1" = group A winner, "W:<match id>" = winner of that
 * match, "BYE"). resolveTournament() works out every slot and winner from the results,
 * so changing an earlier score always flows through to later rounds.
 */

export type Format = "league" | "round_robin" | "knockout" | "groups_knockout";
export type Stage = "league" | "group" | "knockout";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export interface EngineEntry {
  id: string;
  name: string;
  seed: number | null;
  groupLabel: string | null;
  /** Entries sharing a set number never go in the same group. */
  apartSet?: number | null;
}

export interface EngineMatch {
  id: string;
  stage: Stage;
  groupLabel: string | null;
  round: number;
  slot: number;
  roundName: string | null;
  homeId: string | null;
  awayId: string | null;
  homeSource: string | null;
  awaySource: string | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  winnerId: string | null;
}

export interface FormatSettings {
  format: Format;
  legs: 1 | 2;
  groupCount: number;
  advancePerGroup: number;
}

export interface PointsRules {
  win: number;
  draw: number;
  loss: number;
}

export const FORMAT_LABEL: Record<Format, string> = {
  league: "League",
  round_robin: "Round-robin",
  knockout: "Knockout",
  groups_knockout: "Groups + knockout",
};

export const FORMAT_HINT: Record<Format, string> = {
  league: "Everyone plays everyone, home and away if you choose two legs. Top of the table wins.",
  round_robin: "Everyone plays everyone once. Top of the table wins.",
  knockout: "Lose and you're out. Winners go through until the final.",
  groups_knockout: "Small groups play each other, then the top teams go into a knockout.",
};

const GROUP_LETTERS = "ABCDEFGHIJKLMNOP";

// ---------------------------------------------------------------------------
// fixture generation
// ---------------------------------------------------------------------------

type NewMatch = Omit<EngineMatch, "winnerId" | "homeScore" | "awayScore" | "homePens" | "awayPens" | "status"> & { status: MatchStatus };

/** Everyone plays everyone (the circle method). Returns rounds of [home, away] pairs. */
export function roundRobinPairs<T>(teams: T[], legs: 1 | 2 = 1): [T, T][][] {
  const list: (T | null)[] = [...teams];
  if (list.length < 2) return [];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds: [T, T][][] = [];
  const rot = list.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const order = [list[0], ...rot];
    const pairs: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a === null || b === null) continue;
      // Swap home and away every other round so nobody is always at home.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rot.unshift(rot.pop()!);
  }
  if (legs === 2) return [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a] as [T, T]))];
  return rounds;
}

/** Bracket order for seeds 1..size: 1 v size, and the top two seeds can only meet in the final. */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function knockoutRoundName(teamsLeft: number): string {
  if (teamsLeft === 2) return "Final";
  if (teamsLeft === 4) return "Semi-finals";
  if (teamsLeft === 8) return "Quarter-finals";
  return `Round of ${teamsLeft}`;
}

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** A knockout bracket over "sources" (entry ids as "E:<id>", or "A1"-style group places). */
function knockout(sources: string[], newId: () => string, roundOffset = 0): NewMatch[] {
  const size = nextPow2(sources.length);
  const order = bracketOrder(size);
  const seeded = order.map((seed) => sources[seed - 1] ?? "BYE");
  const out: NewMatch[] = [];
  let prev: string[] = [];
  let left = size;
  for (let round = 1; left >= 2; round++, left /= 2) {
    const ids: string[] = [];
    for (let slot = 0; slot < left / 2; slot++) {
      const id = newId();
      ids.push(id);
      const [hs, as] = round === 1 ? [seeded[slot * 2], seeded[slot * 2 + 1]] : [`W:${prev[slot * 2]}`, `W:${prev[slot * 2 + 1]}`];
      out.push({
        id,
        stage: "knockout",
        groupLabel: null,
        round: roundOffset + round,
        slot,
        roundName: knockoutRoundName(left),
        homeId: hs.startsWith("E:") ? hs.slice(2) : null,
        awayId: as.startsWith("E:") ? as.slice(2) : null,
        homeSource: hs,
        awaySource: as,
        status: "scheduled",
      });
    }
    prev = ids;
  }
  return out;
}

/** Snake order for draw position i with g groups: A B C D D C B A A B ... */
function snake(i: number, g: number) {
  const lap = Math.floor(i / g);
  const pos = i % g;
  return lap % 2 === 0 ? pos : g - 1 - pos;
}

/**
 * Which group (0..g-1) each entry goes in, entries in seed order. Follows the snake so the
 * top seeds are spread out, keeps group sizes as even as the snake would, and never puts two
 * entries with the same apart set in one group. When a team's snake group already holds one
 * of its set, it moves to the nearest group that has room. Throws if it can't be done.
 */
export function drawGroups(ordered: Pick<EngineEntry, "apartSet">[], g: number): number[] {
  const n = ordered.length;
  const cap = Array.from({ length: g }, () => 0);
  for (let i = 0; i < n; i++) cap[snake(i, g)]++;
  const bySet = new Map<number, number>();
  for (const e of ordered) if (e.apartSet != null) bySet.set(e.apartSet, (bySet.get(e.apartSet) ?? 0) + 1);
  for (const [set, count] of bySet)
    if (count > g) throw new Error(`Can't keep set ${set} apart: it has ${count} teams but there are only ${g} groups. Take some teams out of the set or use more groups.`);

  const size = Array.from({ length: g }, () => 0);
  const sets = Array.from({ length: g }, () => new Set<number>());
  const out: number[] = new Array(n);
  let steps = 0;
  const place = (i: number): boolean => {
    if (i === n) return true;
    if (++steps > 200_000) return false;
    const want = snake(i, g);
    const tries = Array.from({ length: g }, (_, k) => k).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b);
    const s = ordered[i].apartSet;
    for (const gi of tries) {
      if (size[gi] >= cap[gi] || (s != null && sets[gi].has(s))) continue;
      size[gi]++;
      if (s != null) sets[gi].add(s);
      out[i] = gi;
      if (place(i + 1)) return true;
      size[gi]--;
      if (s != null) sets[gi].delete(s);
    }
    return false;
  };
  if (!place(0)) throw new Error("Couldn't make groups that keep every set apart. Try fewer teams in each set.");
  return out;
}

/**
 * Generate every match for the format. Entries come in seed order (best first).
 * Returns the matches and, for groups, which group each entry is in (snake seeding:
 * A B C D D C B A ..., so the best teams are spread out).
 */
export function generateFixtures(settings: FormatSettings, entries: EngineEntry[], newId: () => string): { matches: NewMatch[]; groups: Record<string, string> } {
  const ordered = [...entries].sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9) || a.name.localeCompare(b.name));
  if (ordered.length < 2) throw new Error("You need at least 2 teams in.");
  const groups: Record<string, string> = {};

  if (settings.format === "league" || settings.format === "round_robin") {
    const legs = settings.format === "league" ? settings.legs : 1;
    const rounds = roundRobinPairs(ordered, legs);
    return {
      groups,
      matches: rounds.flatMap((pairs, r) =>
        pairs.map(([h, a], slot) => ({
          id: newId(), stage: "league" as const, groupLabel: null, round: r + 1, slot, roundName: `Round ${r + 1}`,
          homeId: h.id, awayId: a.id, homeSource: null, awaySource: null, status: "scheduled" as const,
        })),
      ),
    };
  }

  if (settings.format === "knockout") {
    return { groups, matches: knockout(ordered.map((e) => `E:${e.id}`), newId) };
  }

  // Groups + knockout
  const g = Math.max(1, Math.min(settings.groupCount, Math.floor(ordered.length / 2)));
  const labels = GROUP_LETTERS.slice(0, g).split("");
  const members: Record<string, EngineEntry[]> = Object.fromEntries(labels.map((l) => [l, []]));
  drawGroups(ordered, g).forEach((gi, i) => {
    members[labels[gi]].push(ordered[i]);
    groups[ordered[i].id] = labels[gi];
  });
  const matches: NewMatch[] = [];
  let maxRound = 0;
  for (const label of labels) {
    roundRobinPairs(members[label], 1).forEach((pairs, r) => {
      maxRound = Math.max(maxRound, r + 1);
      pairs.forEach(([h, a], slot) =>
        matches.push({
          id: newId(), stage: "group", groupLabel: label, round: r + 1, slot, roundName: `Group ${label} · Round ${r + 1}`,
          homeId: h.id, awayId: a.id, homeSource: null, awaySource: null, status: "scheduled",
        }),
      );
    });
  }
  const advance = Math.max(1, Math.min(settings.advancePerGroup, ...labels.map((l) => members[l].length)));
  // Seeds for the knockout: all group winners first, then all runners-up, and so on.
  const sources: string[] = [];
  for (let place = 1; place <= advance; place++) for (const l of labels) sources.push(`${l}${place}`);
  if (sources.length >= 2) matches.push(...knockout(sources, newId, maxRound));
  return { matches, groups };
}

// ---------------------------------------------------------------------------
// standings
// ---------------------------------------------------------------------------

export interface StandingRow {
  entryId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

const counts = (m: EngineMatch) => m.status === "finished" && m.homeScore != null && m.awayScore != null && m.homeId && m.awayId;

/** Table: points, then goal difference, goals for, head-to-head points, then name. */
export function standings(entries: EngineEntry[], matches: EngineMatch[], pts: PointsRules): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e.id, { entryId: e.id, name: e.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]),
  );
  const played = matches.filter(counts);
  for (const m of played) {
    const h = rows.get(m.homeId!);
    const a = rows.get(m.awayId!);
    if (!h || !a) continue;
    const hs = m.homeScore!;
    const as = m.awayScore!;
    h.played++; a.played++;
    h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
    if (hs > as) { h.won++; a.lost++; h.points += pts.win; a.points += pts.loss; }
    else if (hs < as) { a.won++; h.lost++; a.points += pts.win; h.points += pts.loss; }
    else { h.drawn++; a.drawn++; h.points += pts.draw; a.points += pts.draw; }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;
  const h2h = (x: string, y: string) => {
    let p = 0;
    for (const m of played) {
      if (m.homeId === x && m.awayId === y) p += m.homeScore! > m.awayScore! ? 3 : m.homeScore === m.awayScore ? 1 : 0;
      if (m.awayId === x && m.homeId === y) p += m.awayScore! > m.homeScore! ? 3 : m.homeScore === m.awayScore ? 1 : 0;
    }
    return p;
  };
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || h2h(b.entryId, a.entryId) - h2h(a.entryId, b.entryId) || a.name.localeCompare(b.name),
  );
}

// ---------------------------------------------------------------------------
// results and progression
// ---------------------------------------------------------------------------

/** Who won a finished match: score, then penalties. null for a draw (or not finished). */
export function matchWinner(m: Pick<EngineMatch, "status" | "homeId" | "awayId" | "homeScore" | "awayScore" | "homePens" | "awayPens">): string | null {
  if (m.status !== "finished" || !m.homeId || !m.awayId || m.homeScore == null || m.awayScore == null) return null;
  if (m.homeScore !== m.awayScore) return m.homeScore > m.awayScore ? m.homeId : m.awayId;
  if (m.homePens != null && m.awayPens != null && m.homePens !== m.awayPens) return m.homePens > m.awayPens ? m.homeId : m.awayId;
  return null;
}

/**
 * Work out every knockout slot and every winner from the results. Returns only the matches
 * whose teams, winner or (for byes) status changed, ready to save.
 */
export function resolveTournament(entries: EngineEntry[], matches: EngineMatch[], pts: PointsRules): EngineMatch[] {
  const byId = new Map(matches.map((m) => [m.id, { ...m }]));
  const changed = new Set<string>();
  const set = <K extends keyof EngineMatch>(m: EngineMatch, k: K, v: EngineMatch[K]) => {
    if (m[k] !== v) {
      m[k] = v;
      changed.add(m.id);
    }
  };

  // Group places, once a group has finished every game.
  const places = new Map<string, string>();
  const groupMatches = matches.filter((m) => m.stage === "group");
  for (const label of [...new Set(groupMatches.map((m) => m.groupLabel!))]) {
    const ms = groupMatches.filter((m) => m.groupLabel === label);
    const done = ms.every((m) => m.status === "finished" || m.status === "cancelled");
    if (!done) continue;
    const members = entries.filter((e) => e.groupLabel === label);
    standings(members, ms, pts).forEach((r, i) => places.set(`${label}${i + 1}`, r.entryId));
  }

  for (const m of byId.values()) if (m.stage !== "knockout") set(m, "winnerId", matchWinner(m));

  const ko = [...byId.values()].filter((m) => m.stage === "knockout").sort((a, b) => a.round - b.round || a.slot - b.slot);
  const fromSource = (src: string | null): { id: string | null; bye: boolean } => {
    if (!src || src === "BYE") return { id: null, bye: src === "BYE" };
    if (src.startsWith("E:")) return { id: src.slice(2), bye: false };
    if (src.startsWith("W:") || src.startsWith("L:")) {
      const prev = byId.get(src.slice(2));
      if (!prev) return { id: null, bye: false };
      // A bye feeding a bye (an empty corner of the bracket) is still a bye.
      if (prev.homeSource === "BYE" && prev.awaySource === "BYE") return { id: null, bye: true };
      if (src.startsWith("W:")) return { id: prev.winnerId, bye: false };
      const loser = prev.winnerId ? (prev.winnerId === prev.homeId ? prev.awayId : prev.homeId) : null;
      return { id: loser, bye: false };
    }
    return { id: places.get(src) ?? null, bye: false };
  };
  for (const m of ko) {
    const h = fromSource(m.homeSource);
    const a = fromSource(m.awaySource);
    set(m, "homeId", h.id);
    set(m, "awayId", a.id);
    if (h.bye !== a.bye && (h.id || a.id)) {
      // One side is a bye: the other team goes straight through.
      set(m, "status", "finished");
      set(m, "winnerId", h.id ?? a.id);
    } else if (h.bye && a.bye) {
      set(m, "winnerId", null);
    } else {
      set(m, "winnerId", matchWinner(m));
    }
  }
  return [...changed].map((id) => byId.get(id)!);
}

/** Describe a slot that doesn't have a team yet: "Winner of QF 2", "Group A winner". */
export function describeSource(src: string | null, matches: EngineMatch[]): string {
  if (!src) return "To be decided";
  if (src === "BYE") return "Bye";
  const g = /^([A-P])(\d+)$/.exec(src);
  if (g) return g[2] === "1" ? `Group ${g[1]} winner` : g[2] === "2" ? `Group ${g[1]} runner-up` : `Group ${g[1]}, ${ordinal(Number(g[2]))}`;
  if (src.startsWith("W:") || src.startsWith("L:")) {
    const prev = matches.find((m) => m.id === src.slice(2));
    if (!prev) return "To be decided";
    const short = prev.roundName === "Semi-finals" ? "SF" : prev.roundName === "Quarter-finals" ? "QF" : prev.roundName ?? `R${prev.round}`;
    return `${src.startsWith("W:") ? "Winner" : "Loser"} of ${short} ${prev.slot + 1}`;
  }
  return "To be decided";
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** The champion, once the final is decided (knockout), or the league leader when all games are done. */
export function champion(entries: EngineEntry[], matches: EngineMatch[], format: Format, pts: PointsRules): string | null {
  if (!matches.length) return null;
  if (format === "knockout" || format === "groups_knockout") {
    const final = matches.filter((m) => m.stage === "knockout").sort((a, b) => b.round - a.round)[0];
    return final?.winnerId ?? null;
  }
  if (!matches.every((m) => m.status === "finished" || m.status === "cancelled")) return null;
  return standings(entries, matches, pts)[0]?.entryId ?? null;
}
