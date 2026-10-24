import type { TeamEvent } from "./data/types";

export function eventTitle(e: Pick<TeamEvent, "type" | "title" | "opponent" | "homeAway">) {
  if (e.type === "game") return `${e.homeAway === "away" ? "at" : "vs"} ${e.opponent}`;
  if (e.type === "practice") return e.title || "Practice";
  return e.title || "Team event";
}
