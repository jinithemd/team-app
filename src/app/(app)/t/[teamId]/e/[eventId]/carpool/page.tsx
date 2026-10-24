import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCarpool, getEvent } from "@/lib/data";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTime } from "@/lib/time";
import { CarpoolBoard } from "./board";

export const metadata: Metadata = { title: "Carpool" };

export default async function CarpoolPage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const [e, c] = await Promise.all([getEvent(eventId), getCarpool(eventId)]);
  if (!e || !c || e.teamId !== teamId) notFound();
  const closed = e.status === "cancelled" || Date.parse(e.endAt) < Date.now();
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Event
      </Link>
      <div>
        <h2 className="text-xl font-bold">Carpool</h2>
        <p className="text-sm text-muted">
          {eventTitle(e)} · {formatLongDate(e.startAt, e.tz)} · {e.meetAt ? `meet ${formatTime(e.meetAt, e.tz)}` : `starts ${formatTime(e.startAt, e.tz)}`}
          {e.locationText ? ` · ${e.locationText}` : ""}
        </p>
      </div>
      <CarpoolBoard teamId={teamId} eventId={eventId} view={c} closed={closed} />
      <p className="text-xs text-muted">Only people on the team see the carpool. Pick-up spots are typed in by drivers; we don&apos;t track anyone&apos;s location.</p>
    </div>
  );
}
