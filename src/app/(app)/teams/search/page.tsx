import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listMyTeams, searchTeams } from "@/lib/data";
import { followState, teamsToFollow } from "@/lib/fans";
import { FollowChip } from "@/components/follow-chip";
import { TeamCrest } from "@/components/ui";
import {
  EmptyState,
  PageHeader,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { AskToJoin } from "@/app/c/[slug]/ask-to-join";
import { JoinByCode } from "./join-by-code";

export const metadata: Metadata = { title: "Find a team" };

// S04: find a team or club by name and ask to join, or join straight away with the team's code.
export default async function FindTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [results, suggest, myTeams] = await Promise.all([
    q ? searchTeams(q) : Promise.resolve([]),
    q ? Promise.resolve([]) : teamsToFollow(),
    listMyTeams().catch(() => []),
  ]);
  const mineIds = new Set(myTeams.map((t) => t.id));
  const fs = await followState([
    ...results.map((t) => t.id),
    ...suggest.map((t) => t.id),
  ]);
  const fans = (id: string) => {
    const n = fs.counts.get(id) ?? 0;
    return `${n} ${n === 1 ? "follower" : "followers"}`;
  };
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-6 py-6">
      <PageHeader
        title="Find a team"
        subtitle="Follow any team to see their games and results on your Home page. Playing for one? Ask to join, or use the code from your captain."
      />
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Team or club name
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="e.g. Limestone, Strikers"
          className={inputClass}
        />
        <button className={buttonClass("primary")}>
          <Search aria-hidden />
          Search
        </button>
      </form>
      {q && results.length === 0 && (
        <EmptyState
          icon={<Search />}
          title="No teams found"
          hint="Try part of the name, or ask the captain for the team code."
        />
      )}
      {results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((t) => (
            <li
              key={t.id}
              className="grid gap-2 rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/f/${t.id}`}
                    className="font-semibold hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {[
                      t.club?.name,
                      t.level,
                      t.location,
                      `${t.players} players`,
                      fans(t.id),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {t.club && (
                    <Link
                      href={`/c/${t.club.slug}`}
                      className="text-sm font-semibold text-team-ink"
                    >
                      See the club
                    </Link>
                  )}
                </div>
                {t.mine !== "member" && (
                  <FollowChip
                    teamId={t.id}
                    name={t.name}
                    following={fs.mine.has(t.id)}
                  />
                )}
              </div>
              {t.mine === "member" ? (
                <Link
                  href={`/t/${t.id}/schedule`}
                  className="text-sm font-semibold text-team-ink"
                >
                  You&apos;re on this team
                </Link>
              ) : t.mine === "requested" ? (
                <p className="text-sm font-semibold text-success">
                  Asked to join
                </p>
              ) : (
                <AskToJoin
                  teamId={t.id}
                  path={`/teams/search?q=${encodeURIComponent(q)}`}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {suggest.length > 0 && (
        <section aria-labelledby="sug-h" className="grid gap-2">
          <h2 id="sug-h" className="eyebrow">
            Teams to follow
          </h2>
          <ul className="grid gap-2">
            {suggest.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <Link
                  href={`/f/${t.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <TeamCrest
                    teamId={t.id}
                    name={t.name}
                    crestUrl={t.crestUrl}
                    size={40}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">
                      {t.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {[t.level, t.location, fans(t.id)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
                {mineIds.has(t.id) ? (
                  <span className="text-xs font-semibold text-muted">
                    Your team
                  </span>
                ) : (
                  <FollowChip
                    teamId={t.id}
                    name={t.name}
                    following={fs.mine.has(t.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section
        aria-labelledby="code-h"
        className="grid gap-2 rounded-lg bg-surface p-4"
      >
        <h2 id="code-h" className="font-semibold">
          Join with a team code
        </h2>
        <JoinByCode />
      </section>
    </main>
  );
}
