import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEvent, listEventManagers } from "@/lib/data";
import { EVENT_PERMISSION_LABEL } from "@/lib/data/types";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate } from "@/lib/time";
import { ManagerForm } from "./manager-form";

export const metadata: Metadata = { title: "Event managers" };

export default async function ManagersPage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const [e, m] = await Promise.all([getEvent(eventId), listEventManagers(eventId)]);
  if (!e || !m || e.teamId !== teamId) notFound();
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Event
      </Link>
      <div>
        <h2 className="text-xl font-bold">Hand this event to someone</h2>
        <p className="text-sm text-muted">
          {eventTitle(e)} · {formatLongDate(e.startAt, e.tz)}. Useful for an away trip or a tournament the usual captains can&apos;t make. It only covers this one event.
        </p>
      </div>
      {m.managers.length > 0 && (
        <ul className="grid gap-2">
          {m.managers.map((x) => (
            <li key={x.person.id} className="rounded-lg border border-border p-3">
              <p className="font-semibold">
                {x.person.firstName} {x.person.lastName}
              </p>
              <p className="text-sm text-muted">{x.permissions.map((p) => EVENT_PERMISSION_LABEL[p]).join(" · ")}</p>
              {m.canEdit && <ManagerForm teamId={teamId} eventId={eventId} people={[x.person]} remove />}
            </li>
          ))}
        </ul>
      )}
      {m.canEdit && m.candidates.length > 0 && <ManagerForm teamId={teamId} eventId={eventId} people={m.candidates} />}
    </div>
  );
}
