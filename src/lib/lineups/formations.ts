/*
 * Formations by how many are on the pitch (goalkeeper included). Lines run from the back to
 * the front: "4-4-2" is four defenders, four midfielders, two forwards, plus the keeper.
 */

export const FORMATIONS: Record<number, string[]> = {
  11: ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2"],
  10: ["4-3-2", "3-4-2", "4-4-1"],
  9: ["3-3-2", "3-2-3", "4-3-1"],
  8: ["3-3-1", "3-2-2", "2-3-2"],
  7: ["2-3-1", "3-2-1", "2-2-2"],
  6: ["2-2-1", "3-1-1", "2-1-2"],
  5: ["2-2", "1-2-1", "2-1-1"],
};

export const SIDES = Object.keys(FORMATIONS).map(Number).sort((a, b) => b - a);

export type Line = "GK" | "DEF" | "MID" | "FWD";
export interface Slot {
  line: Line;
  /** 0–100 across the pitch (left to right) and down it (attack at the top, keeper at the bottom). */
  x: number;
  y: number;
}

export function isFormation(f: string) {
  return Object.values(FORMATIONS).some((l) => l.includes(f));
}

/** The keeper plus each line of the formation, laid out on the pitch. */
export function slotsFor(formation: string): Slot[] {
  const lines = formation.split("-").map(Number);
  const out: Slot[] = [{ line: "GK", x: 50, y: 90 }];
  lines.forEach((n, i) => {
    const line: Line = i === 0 ? "DEF" : i === lines.length - 1 ? "FWD" : "MID";
    const y = lines.length === 1 ? 45 : 72 - (i * 56) / (lines.length - 1);
    for (let k = 0; k < n; k++) out.push({ line, x: n === 1 ? 50 : 14 + (k * 72) / (n - 1), y });
  });
  return out;
}

export const sizeOf = (formation: string) => formation.split("-").reduce((a, b) => a + Number(b), 1);

/** GK, DEF, MID or FWD from a roster position like "Centre back" or "Striker". */
export function lineOf(position: string | null | undefined): Line | null {
  if (!position) return null;
  const s = position.toLowerCase();
  if (/goal|keeper|\bgk\b/.test(s)) return "GK";
  if (/defen|back|\bcb\b|\blb\b|\brb\b/.test(s)) return "DEF";
  if (/mid|\bcm\b|\bcdm\b|\bcam\b/.test(s)) return "MID";
  if (/forw|strik|attack|wing|\bst\b|\bcf\b/.test(s)) return "FWD";
  return null;
}

/** Fill the slots from the players who are in, by position where we know it; the rest go on the bench. */
export function autoPick(formation: string, players: { id: string; line: Line | null }[]): { slots: (string | null)[]; subs: string[] } {
  const slots = slotsFor(formation);
  const out: (string | null)[] = slots.map(() => null);
  const left = [...players];
  const take = (pred: (p: (typeof left)[number]) => boolean) => {
    const i = left.findIndex(pred);
    return i < 0 ? null : left.splice(i, 1)[0].id;
  };
  slots.forEach((s, i) => (out[i] = take((p) => p.line === s.line)));
  slots.forEach((s, i) => {
    if (!out[i] && s.line !== "GK") out[i] = take((p) => p.line !== "GK") ?? take(() => true);
  });
  if (!out[0]) out[0] = take(() => true);
  return { slots: out, subs: left.map((p) => p.id) };
}
