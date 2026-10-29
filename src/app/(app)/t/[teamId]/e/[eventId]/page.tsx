import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ticket, ArrowLeft, Car, ChevronRight, ClipboardCheck, Clock, MapPin, Pencil, StickyNote, Trophy, UserCog, Users } from "lucide-react";
import { attendanceSummary, carpoolSummary, eventPerms, getAvailability, getCheckIn, getEvent, getSessionUser, getTeam, myPerms } from "@/lib/data";
import { CheckInCard } from "@/components/check-in";
import { EVENT_TYPE_LABEL, isFixture } from "@/lib/data/types";
import { RsvpControl } from "@/components/rsvp-control";
import { Counts, ScoreBadge, StatusBadge, TypeTag } from "@/components/event-bits";
import { Banner } from "@/components/ui";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTime, formatTimeRange, zoneLabel } from "@/lib/time";
import { StaffEventActions } from "./staff-actions";
import { eventPayments } from "@/lib/payments/service";
import { CashToggle, PayButton } from "@/components/payments";
import { SessionSpot } from "@/components/session-spot";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const e = await getEvent((await params).eventId);
  return { title: e ? eventTitle(e) : "Event" };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; eventId: string }>;
  searchParams: Promise<{ created?: string; saved?: string; payment?: string }>;
}) {
  const { teamId, eventId } = await params;
  const sp = await searchParams;
  const [team, e, avail, user, perms, checkIn, att, ep, pool] = await Promise.all([
    getTeam(teamId), getEvent(eventId), getAvailability(eventId), getSessionUser(), myPerms(teamId), getCheckIn(eventId), attendanceSummary(eventId), eventPerms(eventId), carpoolSummary(eventId),
  ]);
  if (!team || !e || e.teamId !== teamId) notFound();
  const fee = e.feeCents ? await eventPayments(eventId) : null;

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
      {sp.payment === "cancelled" && <Banner tone="warning">Payment cancelled. Nothing was charged.</Banner>}

      <section aria-labelledby="ev-h" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{e.sessionId ? "Drop-in" : EVENT_TYPE_LABEL[e.type]}</span>
          <TypeTag e={e} />
          <StatusBadge status={e.status} />
          <ScoreBadge score={e.score} />
          {e.sessionId ? (
            <Link href={`/s/${e.sessionId}`} className="ml-auto inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-team-ink">
              <Ticket aria-hidden className="size-4" />
              Open session
            </Link>
          ) : e.tournamentId ? (
            <Link href={`/tournaments/${e.tournamentId}`} className="ml-auto inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-team-ink">
              <Trophy aria-hidden className="size-4" />
              Open tournament
            </Link>
          ) : canEdit && !past && (
            <Link href={`/t/${teamId}/e/${eventId}/edit`} className="ml-auto inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-team-ink">
              <Pencil aria-hidden className="size-4" />
              Edit
            </Link>
          )}
        </div>
        <h2 id="ev-h" className={`text-2xl font-bold break-words ${cancelled ? "text-muted line-through" : ""}`}>
          {title}
        </h2>
        {e.tournamentId && <p className="text-xs text-muted">Added by the tournament. The host sets the time and place, and changes show here by themselves.</p>}
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
                <span className="block break-words">{e.locationText}</span>
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

      {checkIn && !e.sessionId && <CheckInCard eventId={e.id} tz={e.tz} {...checkIn} />}

      {canEdit && team.settings.geoCheckinEnabled && !past && !cancelled && e.venue?.lat == null && (
        <Banner tone="warning">
          Players can&apos;t check in to this one: {e.venue ? `${e.venue.name} has no map pin` : "it has no place with a map pin"}.{" "}
          <Link href={e.venue ? `/t/${teamId}/venues?edit=${e.venue.id}#venue-form` : `/t/${teamId}/e/${e.id}/edit`} className="font-semibold text-team-ink underline">
            {e.venue ? "Pin it on the map" : "Add a place"}
          </Link>
        </Banner>
      )}

      {ep.manager && !team.isStaff && (
        <Banner>You&apos;re running this one. The tools you were given are below.</Banner>
      )}

      {isFixture(e.type) && !cancelled && (ep.scoring || e.score) && (
        <Link
          href={`/t/${teamId}/e/${eventId}/match`}
          className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Trophy aria-hidden className="size-6 shrink-0 text-team-ink" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {e.score?.status === "live" ? "Live score" : e.score?.status === "final" ? "Result and player of the match" : "Keep score"}
            </span>
            <span className="block text-sm text-muted">
              {e.score ? `${e.score.us}–${e.score.them}${e.score.status === "live" ? ", updating" : ""}` : "Start the clock at kick-off. Everyone sees the score as it changes."}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted" />
        </Link>
      )}

      {ep.attendance && !cancelled && Date.parse(e.startAt) - Date.now() < 3600_000 && (
        <Link
          href={`/t/${teamId}/e/${eventId}/attendance`}
          className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
        >
          <ClipboardCheck aria-hidden className="size-6 shrink-0 text-team-ink" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{att && att.present + att.late + att.absent + att.excused > 0 ? "Attendance" : "Take attendance"}</span>
            <span className="block text-sm text-muted">
              {att && att.present + att.late + att.absent + att.excused > 0
                ? `${att.present} present · ${att.late} late · ${att.absent} absent${att.geo ? ` · ${att.geo} checked in` : ""}`
                : "Mark who turned up. Points update when you save."}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted" />
        </Link>
      )}

      {e.sessionId && !cancelled && <SessionSpot sessionId={e.sessionId} eventId={e.id} declined={e.mine?.response === "not_going"} />}

      {!e.sessionId && e.mine && user && !(past && att && att.present + att.late > 0) && (
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

      {fee && !cancelled && (
        <section aria-labelledby="fee-h" className="grid gap-3 rounded-lg border border-border p-4">
          <h2 id="fee-h" className="text-lg font-semibold">
            Fee: ${(fee.fee / 100).toFixed(2)} per player
          </h2>
          {fee.iPaid ? (
            <p className="text-sm font-semibold text-success">You&apos;ve paid. Thanks!</p>
          ) : e.mine && fee.collecting ? (
            <PayButton kind="event" refId={e.id} scopeId={teamId} price={fee.price} />
          ) : e.mine ? (
            <p className="text-sm text-muted">Pay the organiser directly (cash or e-Transfer).</p>
          ) : null}
          {fee.staff && fee.rows.length > 0 && (
            <div className="grid gap-1 border-t border-border pt-3">
              <p className="text-sm">
                <strong className="tabular">{fee.rows.filter((r) => r.paid).length}</strong> of {fee.rows.length} paid
              </p>
              <ul>
                {fee.rows.map((r) => (
                  <li key={r.userId} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                    <span className="min-w-0">
                      <span className="block font-semibold">{r.name}</span>
                      {!r.going && <span className="block text-xs text-muted">Not going</span>}
                    </span>
                    <CashToggle eventId={e.id} userId={r.userId} paid={r.paid} name={r.name} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fee.staff && fee.rows.length === 0 && <p className="text-sm text-muted">Players who say they&apos;re going show here with whether they&apos;ve paid.</p>}
        </section>
      )}

      {pool && !cancelled && !past && (pool.cars > 0 || e.homeAway === "away" || e.type === "tournament") && (
        <Link
          href={`/t/${teamId}/e/${eventId}/carpool`}
          className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Car aria-hidden className="size-6 shrink-0 text-team-ink" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Carpool</span>
            <span className="block text-sm text-muted">
              {pool.driving
                ? "You're driving"
                : pool.riding
                  ? "You've got a seat"
                  : pool.cars
                    ? `${pool.cars} ${pool.cars === 1 ? "car" : "cars"} · ${pool.free} ${pool.free === 1 ? "seat" : "seats"} free${pool.waiting ? ` · ${pool.waiting} need a lift` : ""}`
                    : "Nobody's offered a lift yet. Driving? Offer your seats."}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted" />
        </Link>
      )}

      {avail && !cancelled && !e.sessionId && (
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

      {team.isStaff && !past && !cancelled && !e.sessionId && (
        <Link href={`/t/${teamId}/e/${eventId}/managers`} className="inline-flex min-h-10 items-center gap-2 justify-self-start text-sm font-semibold text-team-ink">
          <UserCog aria-hidden className="size-[18px]" />
          Hand this event to someone
        </Link>
      )}

      {team.isStaff && (
        !e.sessionId && <StaffEventActions eventId={e.id} teamId={teamId} status={e.status} noReply={avail?.counts.none ?? 0} past={past} />
      )}

    </div>
  );
}
