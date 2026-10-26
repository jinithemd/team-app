import Link from "next/link";
import { Medal, Trophy } from "lucide-react";
import { getTeam } from "@/lib/data";
import { teamHonours, type Honour } from "@/lib/tournaments/service";
import { TournamentLogo } from "@/components/tournament/bits";

// The team's achievements wall: every tournament it won (Champions) or finished second in
// (Runners-up), newest first. Filled in by itself when a tournament on Clbx finishes.

function Badge({ h }: { h: Honour }) {
  const champ = h.place === "champions";
  return (
    <li>
      <Link
        href={`/tournaments/${h.tournamentId}`}
        className={`grid gap-3 rounded-lg border-2 p-4 hover:shadow-card ${champ ? "border-warning bg-warning-soft" : "border-border bg-surface"}`}
      >
        <span className="flex items-center gap-2">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${champ ? "bg-warning text-on-warning" : "bg-sunken text-fg"}`}>
            {champ ? <Trophy aria-hidden className="size-5" /> : <Medal aria-hidden className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg leading-tight font-bold uppercase">{champ ? "Champions" : "Runners-up"}</span>
            <span className="block text-xs text-muted">{h.year}</span>
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          <TournamentLogo url={h.logoUrl} name={h.name} size={40} />
          <span className="min-w-0">
            <span className="block font-semibold break-words">{h.name}</span>
            {h.hostedBy && <span className="block text-xs text-muted">Hosted by {h.hostedBy}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function Achievements({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [team, honours] = await Promise.all([getTeam(teamId), teamHonours(teamId)]);
  const wins = honours.filter((h) => h.place === "champions");
  const seconds = honours.filter((h) => h.place === "runners_up");
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-xl font-bold">Achievements</h2>
        <p className="text-sm text-muted">
          {honours.length
            ? `${wins.length} ${wins.length === 1 ? "title" : "titles"} and ${seconds.length} runners-up ${seconds.length === 1 ? "finish" : "finishes"} in tournaments on Clbx.`
            : `${team?.name ?? "This team"}'s trophies show here when it wins or reaches the final of a tournament on Clbx.`}
        </p>
      </div>
      {honours.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <Trophy aria-hidden className="size-8 text-muted" />
          <p className="text-sm text-muted">No trophies yet.</p>
          <Link href="/tournaments" className="text-sm font-semibold text-team-ink">
            Find a tournament
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Trophies">
          {honours.map((h) => (
            <Badge key={`${h.tournamentId}-${h.place}`} h={h} />
          ))}
        </ul>
      )}
    </div>
  );
}
