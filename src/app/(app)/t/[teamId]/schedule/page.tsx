import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Plus } from "lucide-react";
import { getTeam, listEvents, listPastEvents } from "@/lib/data";
import { EventCard, ScheduleList } from "@/components/event-bits";
import { Banner, ButtonLink, EmptyState } from "@/components/ui";
import { MonthView } from "@/components/month-view";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ view?: string; joined?: string; past?: string }>;
}) {
  const { teamId } = await params;
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "list";
  const [team, events, past] = await Promise.all([getTeam(teamId), listEvents(teamId), listPastEvents(teamId, sp.past ? 20 : 3)]);
  if (!team) return null;

  return (
    <div className="grid gap-5">
      {sp.joined && <Banner>You&apos;re on the team. Answer below so your captains know if you&apos;re in.</Banner>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Schedule view" className="inline-flex gap-1 rounded-md bg-sunken p-1">
          {(["list", "month"] as const).map((v) => (
            <Link
              key={v}
              href={v === "list" ? `/t/${teamId}/schedule` : `/t/${teamId}/schedule?view=month`}
              aria-current={view === v ? "true" : undefined}
              className={`inline-flex min-h-9 items-center rounded-sm px-3.5 text-sm font-semibold capitalize ${
                view === v ? "bg-team text-on-team" : "text-muted hover:text-fg"
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
        {team.isStaff && (
          <ButtonLink href={`/t/${teamId}/e/new`} size="sm">
            <Plus aria-hidden />
            New event
          </ButtonLink>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="No games or practices yet"
          hint={team.isStaff ? "Add the first one and everyone on the roster gets a heads-up." : "Your captains haven't added anything yet. You'll get a notification when they do."}
          action={
            team.isStaff && (
              <ButtonLink href={`/t/${teamId}/e/new`} size="sm">
                <Plus aria-hidden />
                New event
              </ButtonLink>
            )
          }
        />
      ) : view === "list" ? (
        <ScheduleList events={events} />
      ) : (
        <MonthView events={events} teamId={teamId} />
      )}

      {view === "list" && past.length > 0 && (
        <section aria-labelledby="past-h" className="grid gap-2.5">
          <h2 id="past-h" className="eyebrow">
            Earlier
          </h2>
          {past.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
          {!sp.past && (
            <Link href={`/t/${teamId}/schedule?past=1`} className="justify-self-start text-sm font-semibold text-team-ink">
              Show more past events
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
