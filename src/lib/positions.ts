/*
 * Playing positions by sport, for the position picker. A player can pick up to three;
 * they're stored together in roster_members.position as "Goalkeeper, Centre-back".
 * Sports not listed here (or "Other") get a free-text box instead.
 */

export const MAX_POSITIONS = 3;

const LISTS: Record<string, string[]> = {
  soccer: ["Goalkeeper", "Centre-back", "Full-back", "Wing-back", "Defensive midfielder", "Central midfielder", "Attacking midfielder", "Winger", "Striker"],
  football: ["Quarterback", "Running back", "Wide receiver", "Tight end", "Offensive line", "Defensive line", "Linebacker", "Cornerback", "Safety", "Kicker", "Punter"],
  basketball: ["Point guard", "Shooting guard", "Small forward", "Power forward", "Centre"],
  hockey: ["Goalie", "Defence", "Centre", "Left wing", "Right wing"],
  cricket: ["Batter", "Opening batter", "Wicketkeeper", "Fast bowler", "Spin bowler", "All-rounder"],
  baseball: ["Pitcher", "Catcher", "First base", "Second base", "Third base", "Shortstop", "Left field", "Centre field", "Right field", "Designated hitter"],
  volleyball: ["Setter", "Outside hitter", "Opposite", "Middle blocker", "Libero", "Defensive specialist"],
  rugby: ["Prop", "Hooker", "Lock", "Flanker", "Number 8", "Scrum-half", "Fly-half", "Centre", "Wing", "Fullback"],
  lacrosse: ["Goalie", "Defence", "Midfield", "Attack", "Face-off"],
};

export function positionsFor(sport: string | null | undefined): string[] {
  return LISTS[(sport ?? "").trim().toLowerCase()] ?? [];
}

export function splitPositions(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\s*[,/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const joinPositions = (list: string[]) => list.join(", ");
