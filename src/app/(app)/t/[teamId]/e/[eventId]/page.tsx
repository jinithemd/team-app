import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, MapPin, Pencil, StickyNote, Users } from "lucide-react";
import { getAvailability, getEvent, getSessionUser, getTeam, myPerms } from "@/lib/data";
import { EVENT_TYPE_LABEL, isFixture } from "@/lib/data/types";
import { RsvpControl } from "@/components/rsvp-control";
import { Counts, ScoreBadge, StatusBadge, TypeTag } from "@/components/event-bits";
import { Banner } from "@/components/ui";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTime, formatTimeRange, zoneLabel } from "@/lib/time";
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
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const { teamId, eventId } = await params;
  const sp = await searchParams;
  const [team, e, avail, user, perms] = await Promise.all([getTeam(teamId), getEvent(eventId), getAvailability(eventId), getSessionUser(), myPerms(teamId)]);
  if (!team || !e || e.teamId !== teamId) notFound();

  const title = eventTitle(e);
  const past = Date.parse(e.endAt) < Date.now();
  const cancelled = e.status === "cancelled";
  const mapsHref = e.venue?.lat != null
    ? `https://www.google.com/maps/search/?api=1&query=${e.venue.lat},${e.venue.lng}`
    : e.locationText
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.locationText)}`
      : null;
  const canEdit = isFixture(e.type) ? perms.games : perms.events;
  const lockReason = cancelled ? "This event was cancelled, so answers are closed." : past ? "This event is over." : undefined;

  return (
    <div className="grid gap-6">
      <Link href={`/t/${teamId}/schedule`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Schedule
      </Link>

      {sp.created && <Banner>Added to the schedule. Every player got an email with one-tap answers.</Banner>}
      {sp.saved && <Banner>Saved.</Banner>}

      <section aria-labelledby="ev-h" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{EVENT_TYPE_LABEL[e.type]}</span>
          <TypeTag e={e} />
          <StatusBadge status={e.status} />
          <ScoreBadge score={e.score} />
          {canEdit && !past && (
            <Link href={`/t/${teamId}/e/${eventId}/edit`} className="ml-auto inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-team-ink">
              <Pencil aria-hidden className="size-4" />
              Edit
            </Link>
          )}
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
              {e.meetAt && (
                <>
                  <br />
                  <span className="text-muted">Meet at {formatTime(e.meetAt, e.tz)}</span>
                </>
              )}
            </dd>
          </div>
          {e.locationText && (
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Where</dt>
              <MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd className="min-w-0">
                <span className="break-words">{e.locationText}</span>
                {e.venue?.address && <span className="block text-muted break-words">{e.venue.address}</span>}
                <a href={mapsHref!} target="_blank" rel="noreferrer" className="font-semibold text-team-ink">
                  Open in Maps
                </a>
              </dd>
            </div>
          )}
          {e.squadSize && avail && (
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Players needed</dt>
              <Users aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
              <dd>
                <span className={`font-semibold tabular ${avail.counts.going >= e.squadSize ? "text-success" : "text-warning"}`}>
                  {avail.counts.going} of {e.squadSize}
                </span>{" "}
                players needed so far
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

      {e.mine?.unavailable && !e.mine.response && !past && !cancelled && (
        <Banner tone="warning">
          You&apos;re marked {e.mine.unavailable === "injured" ? "injured" : e.mine.unavailable === "away" ? "away" : "unavailable"} that day, so we&apos;ve put you down as can&apos;t make it. Answer below if that&apos;s changed.{" "}
          <Link href="/availability" className="font-semibold text-team-ink underline">
            Change dates
          </Link>
        </Banner>
      )}

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
