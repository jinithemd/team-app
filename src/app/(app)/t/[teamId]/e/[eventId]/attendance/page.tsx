import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAttendanceSheet } from "@/lib/data";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTime } from "@/lib/time";
import { Banner } from "@/components/ui";
import { AttendanceSheet } from "./sheet";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const sheet = await getAttendanceSheet(eventId);
  if (!sheet || sheet.event.teamId !== teamId) {
    if (!sheet) return <p className="text-muted">Only captains and event managers can take attendance.</p>;
    notFound();
  }
  const e = sheet.event;
  const early = Date.parse(sheet.opensAt) > Date.now();
  return (
    <div className="grid gap-4">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Back to the event
      </Link>
      <div>
        <h2 className="text-xl font-bold">Attendance</h2>
        <p className="text-sm text-muted">
          {eventTitle(e)} · {formatLongDate(e.startAt, e.tz)} · starts {formatTime(e.startAt, e.tz)}
        </p>
      </div>
      {sheet.locked && <Banner tone="warning">{sheet.seasonName} is closed, so these marks are locked.</Banner>}
      {early ? (
        <Banner>Attendance opens at {formatTime(sheet.opensAt, e.tz)}, an hour before the start.</Banner>
      ) : (
        <AttendanceSheet
          eventId={eventId}
          teamId={teamId}
          event={{ type: e.type, homeAway: e.homeAway, startAt: e.startAt, tz: e.tz }}
          rows={sheet.rows}
          rules={sheet.rules}
          pointsEnabled={sheet.pointsEnabled}
          locked={sheet.locked}
        />
      )}
    </div>
  );
}
