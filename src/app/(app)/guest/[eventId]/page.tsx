import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, StickyNote, Users } from "lucide-react";
import { myGuestGame } from "@/lib/guests/service";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTimeRange } from "@/lib/time";
import { GuestAnswer } from "./answer";

export const metadata: Metadata = { title: "Game" };

/** A game I'm asked to as a guest player: the details and my answer. Nothing else of the team's. */
export default async function GuestGamePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const g = await myGuestGame(eventId);
  if (!g) notFound();
  const e = g.event;
  const cancelled = e.status === "cancelled";
  const past = Date.parse(e.endAt) < Date.now();
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      <header className="grid gap-1 border-l-4 pl-3" style={{ borderColor: g.team.color }}>
        <p className="eyebrow">{g.team.name} · You&apos;re a guest</p>
        <h1 className={`font-display text-3xl leading-tight font-bold break-words ${cancelled ? "text-muted line-through" : ""}`}>{eventTitle(e)}</h1>
        {e.status !== "active" && (
          <p className="font-semibold text-danger">
            {cancelled ? "Cancelled" : "Postponed"}
            {e.statusReason ? `: ${e.statusReason}` : ""}
          </p>
        )}
      </header>
      <ul className="grid gap-2.5 text-sm">
        <li className="flex items-start gap-2.5">
          <Clock aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
          <span>
            {formatLongDate(e.startAt, e.tz)}, {formatTimeRange(e.startAt, e.endAt, e.tz)}
          </span>
        </li>
        {e.locationText && (
          <li className="flex items-start gap-2.5">
            <MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.locationText)}`} target="_blank" rel="noreferrer" className="font-semibold text-team-ink underline">
              {e.locationText}
            </a>
          </li>
        )}
        {e.notes && (
          <li className="flex items-start gap-2.5">
            <StickyNote aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
            <span className="whitespace-pre-line">{e.notes}</span>
          </li>
        )}
        <li className="flex items-start gap-2.5">
          <Users aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted" />
          <span>{g.going} going so far</span>
        </li>
      </ul>
      {!cancelled && !past && <GuestAnswer eventId={e.id} current={g.response} />}
      {past && <p className="text-sm text-muted">This game has been played.</p>}
      <p className="text-xs text-muted">You&apos;re on the {g.team.name} guest list, so you get the games they send you. The team&apos;s chat, roster and payments are just for its players.</p>
    </main>
  );
}
