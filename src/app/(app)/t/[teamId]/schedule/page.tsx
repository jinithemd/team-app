import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronDown, Plus } from "lucide-react";
import { getTeam, listEvents, listPastEvents, listTeamSponsors, myPerms } from "@/lib/data";
import { SponsorStrip } from "@/components/sponsor-badge";
import { EventCard, KindLegend, ScheduleList } from "@/components/event-bits";
import { tournamentBadges } from "@/lib/tournaments/service";
import { Banner, ButtonLink, EmptyState } from "@/components/ui";
import { MonthView } from "@/components/month-view";
import { DropInManager } from "@/components/drop-in-manager";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ view?: string; joined?: string; past?: string; weekly?: string }>;
}) {
  const { teamId } = await params;
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "list";
  const [team, events, past, sponsors, perms] = await Promise.all([getTeam(teamId), listEvents(teamId), listPastEvents(teamId, sp.past ? 40 : 10), listTeamSponsors(teamId), myPerms(teamId)]);
  const tBadges = await tournamentBadges([...events, ...past].map((e) => e.tournamentId));
  if (!team) return null;

  return (
    <div className="grid gap-5">
      {sp.weekly && <Banner>Weekly drop-in set up. Each week posts itself, goes on the schedule and tells your players and followers.</Banner>}
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
          title="Nothing on the schedule yet"
          hint={team.isStaff ? "Add a match or training and every player gets a heads-up." : "Your captains haven't added anything yet. You'll get a notification when they do."}
          action={
            team.isStaff && (
              <ButtonLink href={`/t/${teamId}/e/new`} size="sm">
                <Plus aria-hidden />
                New event
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <KindLegend />
          {view === "list" ? <ScheduleList events={events} tournaments={tBadges} /> : <MonthView events={events} teamId={teamId} />}
        </>
      )}

      {/* Past events stay folded under one heading until you open it. */}
      {view === "list" && past.length > 0 && (
        <details className="group grid gap-2.5" open={!!sp.past}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-border px-3 font-semibold hover:bg-surface [&::-webkit-details-marker]:hidden">
            <span>Past events</span>
            <ChevronDown aria-hidden className="size-5 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 grid gap-2.5">
            {past.map((e) => (
              <EventCard key={e.id} e={e} tournament={e.tournamentId ? tBadges[e.tournamentId] : undefined} />
            ))}
            {!sp.past && past.length >= 10 && (
              <Link href={`/t/${teamId}/schedule?past=1`} className="justify-self-start text-sm font-semibold text-team-ink">
                Show more past events
              </Link>
            )}
          </div>
        </details>
      )}
      {team.isStaff && <DropInManager teamId={teamId} />}
      {perms.settings && <SponsorStrip sponsors={sponsors} manageHref={`/t/${teamId}/sponsors`} />}
    </div>
  );
}
