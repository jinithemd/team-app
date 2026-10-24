import type { TeamEvent } from "./data/types";

export function eventTitle(e: Pick<TeamEvent, "type" | "title" | "opponent" | "homeAway">) {
  if (e.type === "match") return `${e.homeAway === "away" ? "at" : "vs"} ${e.opponent}`;
  if (e.type === "training") return e.title || "Training";
  if (e.type === "tournament") return e.title || (e.opponent ? `Tournament vs ${e.opponent}` : "Tournament");
  return e.title || "Team event";
}
