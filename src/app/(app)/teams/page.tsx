import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search, Trophy, Users } from "lucide-react";
import { listMyTournaments } from "@/lib/tournaments/service";
import { listMyClubs, listMyTeams } from "@/lib/data";
import { CLUB_ROLE_LABEL } from "@/lib/data/types";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { HatBadges } from "@/components/hats";
import { hatLabels } from "@/lib/data/types";
import { TeamCrest } from "@/components/ui";
import { crestUrl } from "@/lib/images";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const [teams, clubs, tours] = await Promise.all([listMyTeams(), listMyClubs(), listMyTournaments().catch(() => null)]);
  const invites = tours?.invitations.length ?? 0;
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-5 py-6">
      <PageHeader
        title="Teams"
        action={
          <div className="flex gap-2">
            <ButtonLink href="/teams/search" variant="secondary" size="sm">
              <Search aria-hidden />
              Find a team
            </ButtonLink>
            <ButtonLink href="/teams/new" size="sm">
              <Plus aria-hidden />
              Start a team
            </ButtonLink>
          </div>
        }
      />
      <Link href="/tournaments" className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-focus">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-fg text-bg">
          <Trophy className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Tournaments</span>
          <span className="block text-sm text-muted">Cups and leagues: host one, or see invitations for your teams</span>
        </span>
        {invites > 0 && (
          <span className="grid h-6 min-w-6 place-items-center rounded-pill bg-danger px-1.5 text-xs font-bold text-on-danger tabular">
            {invites}
            <span className="sr-only"> invitations</span>
          </span>
        )}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
      {clubs.length > 0 && (
        <section aria-labelledby="clubs-h" className="grid gap-2">
          <h2 id="clubs-h" className="eyebrow">
            Clubs you run
          </h2>
          <ul className="grid gap-2">
            {clubs.map((c) => (
              <li key={c.id}>
                <Link href={`/clubs/${c.id}`} className="flex min-h-14 items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input">
                  <span aria-hidden className="size-10 shrink-0 rounded-md" style={{ background: c.color, boxShadow: c.colorSecondary ? `inset 0 -4px 0 ${c.colorSecondary}` : undefined }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-sm text-muted">
                      {CLUB_ROLE_LABEL[c.myRole]} · {c.teamCount} {c.teamCount === 1 ? "team" : "teams"}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {teams.length ? (
        <ul className="grid gap-2.5">
          {teams.map((t) => (
            <li key={t.id} data-team={t.id}>
              <Link
                href={`/t/${t.id}/schedule`}
                className="flex min-h-18 items-center gap-3 rounded-lg border border-border bg-bg p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <TeamCrest teamId={t.id} name={t.name} crestUrl={crestUrl(t.id, t.settings.crest)} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{t.name}</span>
                  <span className="block text-sm text-muted">
                    {[t.club?.name, t.level].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 block">
                    <HatBadges labels={hatLabels(t.hats, t.me?.jersey)} />
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Users />}
          title="No teams yet"
          hint="Start a team and invite your players. If your captain invited you, open the link in their email."
          action={
            <ButtonLink href="/teams/new" size="sm">
              <Plus aria-hidden />
              Start a team
            </ButtonLink>
          }
        />
      )}
    </main>
  );
}
