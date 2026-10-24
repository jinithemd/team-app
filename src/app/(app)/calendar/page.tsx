import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { listMyTeams, listUpcomingForMe } from "@/lib/data";
import { ScheduleList } from "@/components/event-bits";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

// S18: every team I'm on in one list, filterable by team.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team } = await searchParams;
  const [teams, events] = await Promise.all([listMyTeams(), listUpcomingForMe(200)]);
  const filtered = team ? events.filter((e) => e.teamId === team) : events;
  const chips: [string | null, string][] = [[null, "All"], ...teams.map((t) => [t.id, t.name] as [string, string])];

  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
      <PageHeader title="Calendar" subtitle={teams.length > 1 ? `All ${teams.length} teams in one place` : undefined} />
      {teams.length > 1 && (
        <nav aria-label="Show events for" className="flex flex-wrap gap-2">
          {chips.map(([tid, name]) => {
            const on = (team ?? null) === tid;
            return (
              <Link
                key={tid ?? "all"}
                href={tid ? `/calendar?team=${tid}` : "/calendar"}
                aria-current={on ? "true" : undefined}
                data-team={tid ?? undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-semibold ${on ? "border-fg bg-fg text-bg" : "border-border-input text-fg hover:bg-surface"}`}
              >
                {tid && <span aria-hidden className="size-2.5 rounded-pill bg-team ring-1 ring-border" />}
                {name}
              </Link>
            );
          })}
        </nav>
      )}
      {filtered.length ? (
        <ScheduleList events={filtered} showTeam={teams.length > 1} />
      ) : (
        <EmptyState icon={<CalendarDays />} title="Nothing coming up" hint="Games, trainings and events from all your teams show up here." />
      )}
      <p className="text-xs text-muted">Adding this calendar to your phone&apos;s calendar app comes in a later build.</p>
    </main>
  );
}
