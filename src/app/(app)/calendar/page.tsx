import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { listMyTeams, listUpcomingForMe } from "@/lib/data";
import { ScheduleList } from "@/components/event-bits";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

// S18 family calendar: every team and every kid in one list, filterable by kid.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { who } = await searchParams;
  const [teams, events] = await Promise.all([listMyTeams(), listUpcomingForMe(200)]);
  const people = new Map<string, string>();
  teams.forEach((t) => t.myPeople.forEach((p) => people.set(p.id, p.firstName)));
  const filtered = who ? events.filter((e) => e.mine.some((m) => m.person.id === who)) : events;
  const chips: [string | null, string][] = [[null, "Everyone"], ...[...people.entries()]];

  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
      <PageHeader title="Calendar" subtitle={teams.length > 1 ? `All ${teams.length} teams in one place` : undefined} />
      {people.size > 1 && (
        <nav aria-label="Show events for" className="flex flex-wrap gap-2">
          {chips.map(([pid, name]) => {
            const on = (who ?? null) === pid;
            return (
              <Link
                key={pid ?? "all"}
                href={pid ? `/calendar?who=${pid}` : "/calendar"}
                aria-current={on ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-pill border px-3.5 text-sm font-semibold ${on ? "border-fg bg-fg text-bg" : "border-border-input text-fg hover:bg-surface"}`}
              >
                {name}
              </Link>
            );
          })}
        </nav>
      )}
      {filtered.length ? (
        <ScheduleList events={filtered} showTeam={teams.length > 1} />
      ) : (
        <EmptyState icon={<CalendarDays />} title="Nothing coming up" hint="Games, practices and events from all your teams show up here." />
      )}
      <p className="text-xs text-muted">Adding this calendar to your phone&apos;s calendar app comes in a later build.</p>
    </main>
  );
}
