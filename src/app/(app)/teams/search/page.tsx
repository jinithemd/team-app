import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchTeams } from "@/lib/data";
import { EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { AskToJoin } from "@/app/c/[slug]/ask-to-join";
import { JoinByCode } from "./join-by-code";

export const metadata: Metadata = { title: "Find a team" };

// S04: find a team or club by name and ask to join, or join straight away with the team's code.
export default async function FindTeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = q ? await searchTeams(q) : [];
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-6 py-6">
      <PageHeader title="Find a team" subtitle="Search by team or club name. Got a code from your captain? Use it below to join straight away." />
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Team or club name
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="e.g. Limestone, Strikers" className={inputClass} />
        <button className={buttonClass("primary")}>
          <Search aria-hidden />
          Search
        </button>
      </form>
      {q && results.length === 0 && <EmptyState icon={<Search />} title="No teams found" hint="Try part of the name, or ask the captain for the team code." />}
      {results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((t) => (
            <li key={t.id} className="grid gap-2 rounded-lg border border-border p-4">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-muted">
                  {[t.club?.name, t.level, t.location, `${t.players} players`].filter(Boolean).join(" · ")}
                </p>
                {t.club && (
                  <Link href={`/c/${t.club.slug}`} className="text-sm font-semibold text-team-ink">
                    See the club
                  </Link>
                )}
              </div>
              {t.mine === "member" ? (
                <Link href={`/t/${t.id}/schedule`} className="text-sm font-semibold text-team-ink">
                  You&apos;re on this team
                </Link>
              ) : t.mine === "requested" ? (
                <p className="text-sm font-semibold text-success">Asked to join</p>
              ) : (
                <AskToJoin teamId={t.id} path={`/teams/search?q=${encodeURIComponent(q)}`} />
              )}
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="code-h" className="grid gap-2 rounded-lg bg-surface p-4">
        <h2 id="code-h" className="font-semibold">
          Join with a team code
        </h2>
        <JoinByCode />
      </section>
    </main>
  );
}
