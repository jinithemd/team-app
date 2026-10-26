// node --experimental-strip-types --no-warnings src/lib/tournaments/engine.test.ts
import assert from "node:assert/strict";
import { bracketOrder, champion, generateFixtures, resolveTournament, roundRobinPairs, standings, type EngineEntry, type EngineMatch } from "./engine.ts";

let n = 0;
const id = () => `m${++n}`;
const teams = (k: number): EngineEntry[] => Array.from({ length: k }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, seed: i + 1, groupLabel: null }));
const PTS = { win: 3, draw: 1, loss: 0 };
const asMatches = (ms: ReturnType<typeof generateFixtures>["matches"]): EngineMatch[] => ms.map((m) => ({ ...m, homeScore: null, awayScore: null, homePens: null, awayPens: null, winnerId: null }));
function play(ms: EngineMatch[], idv: string, h: number, a: number, pens?: [number, number]) {
  const m = ms.find((x) => x.id === idv)!;
  Object.assign(m, { status: "finished", homeScore: h, awayScore: a, homePens: pens?.[0] ?? null, awayPens: pens?.[1] ?? null });
}
const apply = (entries: EngineEntry[], ms: EngineMatch[]) => {
  for (const c of resolveTournament(entries, ms, PTS)) Object.assign(ms.find((m) => m.id === c.id)!, c);
};

// Round-robin: every pair exactly once, nobody twice in a round, odd numbers get a rest.
for (const k of [2, 3, 4, 5, 6, 7, 8]) {
  const rounds = roundRobinPairs(teams(k).map((t) => t.id));
  const seen = new Set<string>();
  for (const r of rounds) {
    const inRound = r.flat();
    assert.equal(new Set(inRound).size, inRound.length);
    for (const [a, b] of r) seen.add([a, b].sort().join("-"));
  }
  assert.equal(seen.size, (k * (k - 1)) / 2, `round robin ${k}`);
}
// League, two legs: each pair twice, once at each home.
{
  const { matches } = generateFixtures({ format: "league", legs: 2, groupCount: 1, advancePerGroup: 1 }, teams(4), id);
  assert.equal(matches.length, 12);
  const homeAway = new Set(matches.map((m) => `${m.homeId}>${m.awayId}`));
  assert.equal(homeAway.size, 12);
}
// Bracket order keeps top seeds apart.
assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);

// Knockout with 6 teams: byes for seeds 1 and 2, they go straight through.
{
  const es = teams(6);
  const ms = asMatches(generateFixtures({ format: "knockout", legs: 1, groupCount: 1, advancePerGroup: 1 }, es, id).matches);
  apply(es, ms);
  const r1 = ms.filter((m) => m.round === 1);
  assert.equal(r1.length, 4);
  assert.equal(r1.filter((m) => m.status === "finished").length, 2, "two byes");
  const sf = ms.filter((m) => m.roundName === "Semi-finals");
  assert.equal(sf.length, 2);
  assert.ok(sf.some((m) => m.homeId === "t1"), "seed 1 through to the semis");
  // Play the real first-round games; winners fill the semis.
  for (const m of r1.filter((m) => m.status !== "finished")) play(ms, m.id, 2, 1);
  apply(es, ms);
  assert.ok(sf.every((m) => ms.find((x) => x.id === m.id)!.homeId && ms.find((x) => x.id === m.id)!.awayId));
  // A draw needs penalties to produce a winner.
  const s1 = ms.find((m) => m.roundName === "Semi-finals" && m.slot === 0)!;
  play(ms, s1.id, 1, 1);
  apply(es, ms);
  assert.equal(ms.find((m) => m.id === s1.id)!.winnerId, null);
  play(ms, s1.id, 1, 1, [4, 3]);
  apply(es, ms);
  const fin = ms.find((m) => m.roundName === "Final")!;
  assert.equal(fin.homeId, s1.homeId);
  // Change an earlier result: it flows through.
  play(ms, s1.id, 0, 2);
  apply(es, ms);
  assert.equal(ms.find((m) => m.roundName === "Final")!.homeId, s1.awayId);
  const s2 = ms.find((m) => m.roundName === "Semi-finals" && m.slot === 1)!;
  play(ms, s2.id, 3, 0);
  apply(es, ms);
  const f = ms.find((m) => m.roundName === "Final")!;
  play(ms, f.id, 2, 0);
  apply(es, ms);
  assert.equal(champion(es, ms, "knockout", PTS), f.homeId);
}

// Groups + knockout: 8 teams, 2 groups, top 2 through → semis A1 v B2, B1 v A2.
{
  const es = teams(8);
  const { matches, groups } = generateFixtures({ format: "groups_knockout", legs: 1, groupCount: 2, advancePerGroup: 2 }, es, id);
  for (const e of es) e.groupLabel = groups[e.id];
  assert.deepEqual(es.map((e) => e.groupLabel).join(""), "ABBAABBA");
  const ms = asMatches(matches);
  assert.equal(ms.filter((m) => m.stage === "group").length, 12);
  const semis = ms.filter((m) => m.stage === "knockout" && m.roundName === "Semi-finals");
  assert.deepEqual(semis.map((m) => `${m.homeSource} v ${m.awaySource}`), ["A1 v B2", "B1 v A2"]);
  apply(es, ms);
  assert.ok(semis.every((m) => !ms.find((x) => x.id === m.id)!.homeId), "no teams until groups finish");
  // Lower seed number wins every group game.
  for (const m of ms.filter((m) => m.stage === "group")) {
    const h = Number(m.homeId!.slice(1)), a = Number(m.awayId!.slice(1));
    play(ms, m.id, h < a ? 2 : 0, h < a ? 0 : 2);
  }
  apply(es, ms);
  const s = ms.filter((m) => m.roundName === "Semi-finals");
  assert.deepEqual(s.map((m) => `${m.homeId} v ${m.awayId}`), ["t1 v t3", "t2 v t4"]);
  const tableA = standings(es.filter((e) => e.groupLabel === "A"), ms.filter((m) => m.groupLabel === "A"), PTS);
  assert.equal(tableA[0].entryId, "t1");
  assert.equal(tableA[0].points, 9);
  assert.equal(tableA[0].gd, 6);
}

// Standings: points, then goal difference.
{
  const es = teams(3);
  const ms = asMatches(generateFixtures({ format: "round_robin", legs: 1, groupCount: 1, advancePerGroup: 1 }, es, id).matches);
  const find = (a: string, b: string) => ms.find((m) => (m.homeId === a && m.awayId === b) || (m.homeId === b && m.awayId === a))!;
  const set = (a: string, b: string, ga: number, gb: number) => { const m = find(a, b); m.homeId === a ? play(ms, m.id, ga, gb) : play(ms, m.id, gb, ga); };
  set("t1", "t2", 1, 1); set("t1", "t3", 5, 0); set("t2", "t3", 1, 0);
  const t = standings(es, ms, PTS);
  assert.deepEqual(t.map((r) => [r.entryId, r.points, r.gd]), [["t1", 4, 5], ["t2", 4, 1], ["t3", 0, -6]]);
  assert.equal(champion(es, ms, "round_robin", PTS), "t1");
}
console.log("tournament engine: all checks pass");
