import Link from "next/link";
import { Search } from "lucide-react";
import { followingFeed } from "@/lib/fans";
import { SectionTitle, TeamCrest } from "@/components/ui";
import { DEFAULT_TZ, formatTime } from "@/lib/time";

/** Home: what the teams I follow are up to. Latest results, live scores, their next game. */
export async function FollowingFeed() {
  const items = await followingFeed().catch(() => []);
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
  return (
    <section aria-labelledby="fol-h" className="grid gap-3">
      <SectionTitle
        action={
          <Link href="/teams/search" className="text-sm font-semibold text-team-ink">
            Find teams
          </Link>
        }
      >
        <span id="fol-h">Teams you follow</span>
      </SectionTitle>
      {items.length === 0 ? (
        <Link href="/teams/search" className="flex min-h-14 items-center gap-3 rounded-lg border border-dashed border-border-input p-3 text-sm text-muted">
          <Search aria-hidden className="size-5 shrink-0" />
          Follow any team to see their results and next games here.
        </Link>
      ) : (
        <ul className="grid gap-2">
          {items.map(({ team, game: g, kind }) => {
            const vs = g.type === "tournament" ? (g.title ?? "Tournament") : g.opponent ? `vs ${g.opponent}` : (g.title ?? "Match");
            const res = g.score ? (g.score.us > g.score.them ? "W" : g.score.us < g.score.them ? "L" : "D") : null;
            return (
              <li key={`${team.id}-${g.id}`}>
                <Link href={`/f/${team.id}`} className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input">
                  <TeamCrest teamId={team.id} name={team.name} crestUrl={team.crestUrl} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-muted">{team.name}</span>
                    <span className="block font-semibold break-words">{vs}</span>
                    <span className="block text-xs text-muted">
                      {kind === "next" ? `${day(g.startAt)} · ${formatTime(g.startAt, DEFAULT_TZ)}${g.locationText ? ` · ${g.locationText}` : ""}` : day(g.startAt)}
                    </span>
                  </span>
                  {g.score ? (
                    <span className="grid shrink-0 justify-items-end">
                      <span className="font-display text-xl font-bold tabular">
                        {g.score.us}–{g.score.them}
                      </span>
                      {kind === "live" ? (
                        <span className="text-xs font-bold text-danger">Live</span>
                      ) : (
                        <span className={`text-xs font-bold ${res === "W" ? "text-success" : res === "L" ? "text-danger" : "text-muted"}`}>{res === "W" ? "Won" : res === "L" ? "Lost" : "Draw"}</span>
                      )}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.04em] uppercase">Next</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
