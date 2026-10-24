import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEvent, listVenues, myPerms } from "@/lib/data";
import { isFixture } from "@/lib/data/types";
import { utcToZoned } from "@/lib/time";
import { EventForm } from "@/components/event-form";
import { DeleteEvent } from "./delete-event";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const [e, perms, venues] = await Promise.all([getEvent(eventId), myPerms(teamId), listVenues(teamId)]);
  if (!e || e.teamId !== teamId) notFound();
  const allowed = isFixture(e.type) ? perms.games : perms.events;
  if (!allowed)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">You can&apos;t change this event</h2>
        <p className="text-muted">{isFixture(e.type) ? "Matches are changed by your manager." : "Ask your captain."}</p>
      </div>
    );
  const s = utcToZoned(e.startAt, e.tz);
  const end = utcToZoned(e.endAt, e.tz);
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Back to the event
      </Link>
      <h2 className="text-xl font-bold">Edit event</h2>
      <EventForm
        teamId={teamId}
        tz={e.tz}
        venues={venues}
        canFixtures={perms.games}
        canEvents={perms.events}
        eventId={eventId}
        inSeries={!!e.seriesId}
        initial={{
          type: e.type,
          competition: e.competition ?? "league",
          title: e.title ?? "",
          date: s.date,
          startTime: s.time,
          endTime: end.time,
          meetMinutes: e.meetAt ? String(Math.round((Date.parse(e.startAt) - Date.parse(e.meetAt)) / 60000)) : "0",
          venueId: e.venueId ?? "",
          locationText: e.venueId ? "" : e.locationText ?? "",
          opponent: e.opponent ?? "",
          homeAway: e.homeAway ?? "home",
          notes: e.notes ?? "",
          squadSize: e.squadSize ? String(e.squadSize) : "",
        }}
      />
      <DeleteEvent eventId={eventId} inSeries={!!e.seriesId} />
    </div>
  );
}
