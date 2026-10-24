import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, MapPin, StickyNote } from "lucide-react";
import { getAvailability, getEvent, getSessionUser, getTeam } from "@/lib/data";
import { RsvpControl } from "@/components/rsvp-control";
import { Counts, StatusBadge, TypeTag } from "@/components/event-bits";
import { Banner } from "@/components/ui";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTimeRange, zoneLabel } from "@/lib/time";
import { StaffEventActions } from "./staff-actions";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const e = await getEvent((await params).eventId);
  return { title: e ? eventTitle(e) : "Event" };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; eventId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { teamId, eventId } = await params;
  const sp = await searchParams;
  const [team, e, avail, user] = await Promise.all([getTeam(teamId), getEvent(eventId), getAvailability(eventId), getSessionUser()]);
  if (!team || !e || e.teamId !== teamId) notFound();

  const title = eventTitle(e);
  const past = Date.parse(e.endAt) < Date.now();
  const cancelled = e.status === "cancelled";
  const mapsHref = e.locationText ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.locationText)}` : null;
  const lockReason = cancelled ? "This event was cancelled, so answers are closed." : past ? "This event is over." : undefined;

  return (
    <div className="grid gap-6">
      <Link href={`/t/${teamId}/schedule`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Schedule
      </Link>

      {sp.created && <Banner>Added to the schedule. Every player got an email with one-tap answers.</Banner>}

      <section aria-labelledby="ev-h" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{e.type === "game" ? "Match" : e.type === "practice" ? "Training" : "Event"}</span>
          <TypeTag e={e} />
          <StatusBadge status={e.status} />
        </div>
        <h2 id="ev-h" className={`text-2xl font-bold break-words ${cancelled ? "text-muted line-through" : ""}`}>
          {title}
        </h2>
        {cancelled && e.statusReason && <Banner tone="danger">Cancelled: {e.statusReason}</Banner>}
        {e.status === "postponed" && <Banner tone="warning">Postponed{e.statusReason ? `: ${e.statusReason}` : ". A new time will be posted."}</Banner>}
        <dl className="grid gap-2.5 text-sm">
          <div className="flex items-start gap-2.5">
            <dt className="sr-only">When</dt>
            <Clock aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
            <dd>
              <span className="font-semibold">{formatLongDate(e.startAt, e.tz)}</span>
              <br />
              {formatTimeRange(e.startAt, e.endAt, e.tz)} <span className="text-muted">· {zoneLabel(e.tz)}</span>
            </dd>
          </div>
          {e.locationText && (
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Where</dt>
              <MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd className="min-w-0">
                <span className="break-words">{e.locationText}</span>
                <br />
                <a href={mapsHref!} target="_blank" rel="noreferrer" className="font-semibold text-team-ink">
                  Open in Maps
                </a>
              </dd>
            </div>
          )}
          {e.notes && (
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Notes</dt>
              <StickyNote aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd className="break-words whitespace-pre-line">{e.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      {e.mine && user && (
        <section aria-labelledby="mine-h" className="grid gap-4 rounded-lg border border-border p-4">
          <h2 id="mine-h" className="text-lg font-semibold">
            Are you in?
          </h2>
          <RsvpControl
            eventId={e.id}
            userId={user.id}
            personName={user.firstName}
            initial={e.mine.response}
            initialNote={e.mine.note}
            locked={lockReason}
          />
        </section>
      )}

      {avail && !cancelled && (
        <section aria-labelledby="avail-h" className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="avail-h" className="text-lg font-semibold">
              Who&apos;s coming
            </h2>
            <Link href={`/t/${teamId}/e/${eventId}/rsvps`} className="inline-flex items-center gap-0.5 text-sm font-semibold text-team-ink">
              See everyone
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
          <Counts counts={avail.counts} />
        </section>
      )}

      {team.isStaff && (
        <StaffEventActions eventId={e.id} teamId={teamId} status={e.status} noReply={avail?.counts.none ?? 0} past={past} />
      )}

    </div>
  );
}
