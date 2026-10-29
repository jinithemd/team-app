import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTeam, listVenues, myPerms } from "@/lib/data";
import { DEFAULT_TZ, utcToZoned } from "@/lib/time";
import { EventForm } from "@/components/event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ type?: string; weekly?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [team, perms, venues] = await Promise.all([getTeam(teamId), myPerms(teamId), listVenues(teamId)]);
  if (!team) notFound();
  if (!perms.games && !perms.events)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only captains and managers can add events</h2>
        <p className="text-muted">Ask your captain if something is missing from the schedule.</p>
      </div>
    );
  const today = utcToZoned(new Date().toISOString(), DEFAULT_TZ).date;
  const type = sp.type === "training" || sp.type === "social" || sp.type === "tournament" ? sp.type : "match";
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/schedule`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Schedule
      </Link>
      <h2 className="text-xl font-bold">New event</h2>
      <EventForm
        teamId={teamId}
        tz={DEFAULT_TZ}
        venues={venues}
        canFixtures={perms.games}
        canEvents={perms.events}
        startDropIn={sp.type === "dropin"}
        startWeekly={sp.weekly === "1"}
        teamName={team.name}
        today={today}
        initial={{
          type,
          competition: "league",
          title: "",
          date: today,
          startTime: type === "training" ? "18:00" : "10:00",
          endTime: type === "training" ? "19:15" : "11:30",
          meetMinutes: type === "match" ? "30" : "0",
          venueId: "",
          locationText: "",
          opponent: "",
          homeAway: "home",
          notes: "",
          squadSize: "",
          sponsorVisible: "auto",
        }}
      />
    </div>
  );
}
