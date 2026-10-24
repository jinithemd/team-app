import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { listMyTeams } from "@/lib/data";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const teams = await listMyTeams();
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
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
      {teams.length ? (
        <ul className="grid gap-2.5">
          {teams.map((t) => (
            <li key={t.id} data-team={t.id}>
              <Link
                href={`/t/${t.id}/schedule`}
                className="flex min-h-18 items-center gap-3 rounded-lg border border-border bg-bg p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-pill border-2 border-team-2 bg-team font-display text-lg font-bold text-on-team">
                  {initials(t.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{t.name}</span>
                  <span className="block text-sm text-muted">
                    {[t.sport, t.ageGroup, t.location].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-team-ink">
                    {t.isStaff ? "Staff" : t.myPeople.map((p) => p.firstName).join(", ")}
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
          hint="Start a team and invite your players. If your coach invited you, open the link in their email."
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

function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  return (words.slice(0, 2).map((w) => w[0]).join("") || name.slice(0, 2)).toUpperCase();
}
