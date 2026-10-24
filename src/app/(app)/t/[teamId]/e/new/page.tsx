import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTeam } from "@/lib/data";
import { DEFAULT_TZ, utcToZoned } from "@/lib/time";
import { NewEventForm } from "./new-event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) notFound();
  if (!team.isStaff)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only captains and managers can add events</h2>
        <p className="text-muted">Ask your captain if something is missing from the schedule.</p>
      </div>
    );
  const today = utcToZoned(new Date().toISOString(), DEFAULT_TZ).date;
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/schedule`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Schedule
      </Link>
      <h2 className="text-xl font-bold">New event</h2>
      <NewEventForm teamId={teamId} defaultDate={today} tz={DEFAULT_TZ} />
    </div>
  );
}
