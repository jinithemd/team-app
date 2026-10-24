import type { Attendance, PointsReason, PointsRules, TeamEvent } from "./types";

/**
 * Points one attendance mark earns, from the team's rules. Pure, so the seed data, the
 * attendance screen preview and the server all agree. Re-saving replaces these rows, which
 * matches the SQL unique index (one automatic row per event, player and reason).
 */
export function pointsForAttendance(
  e: Pick<TeamEvent, "type" | "homeAway">,
  a: Pick<Attendance, "status" | "minutesLate">,
  rules: PointsRules,
): { reason: PointsReason; points: number }[] {
  if (a.status !== "present" && a.status !== "late") return [];
  const out: { reason: PointsReason; points: number }[] = [];
  if (e.type === "match" || e.type === "tournament") {
    out.push({ reason: "match", points: rules.match });
    if (e.homeAway === "away" && rules.away_bonus) out.push({ reason: "away_bonus", points: rules.away_bonus });
  } else if (e.type === "training") {
    out.push({ reason: "training", points: rules.training });
  }
  if (a.status === "late" && (a.minutesLate ?? 0) >= rules.late_after_minutes && rules.late_penalty)
    out.push({ reason: "late_penalty", points: rules.late_penalty });
  return out.filter((x) => x.points !== 0);
}

export const POINTS_REASON_LABEL: Record<PointsReason, string> = {
  training: "Training",
  match: "Match played",
  away_bonus: "Away bonus",
  late_penalty: "Late",
  potm: "Player of the match",
  manual: "Added by a captain",
};
