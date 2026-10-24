import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { listPendingRsvps } from "@/lib/data";
import { RsvpControl } from "@/components/rsvp-control";
import { TeamDot } from "@/components/event-bits";
import { EmptyState, PageHeader } from "@/components/ui";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Your answers" };

// S11: every unanswered invitation across all teams and kids, answerable in place.
export default async function MyRsvpsPage() {
  const pending = await listPendingRsvps();
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-5 py-6">
      <PageHeader title="Your answers" subtitle={pending.length ? "Let coaches know who's coming. Answers save as you tap." : undefined} />
      {pending.length === 0 ? (
        <EmptyState icon={<CheckCircle2 />} title="You've answered everything" hint="New games and practices show up here when coaches add them." />
      ) : (
        <ul className="grid gap-3">
          {pending.map((e) => (
            <li key={e.id} data-team={e.teamId} className="grid gap-3 rounded-lg border border-border p-4">
              <div className="min-w-0">
                <TeamDot name={e.team.name} />
                <Link href={`/t/${e.teamId}/e/${e.id}`} className="mt-1 block text-base font-semibold break-words hover:underline">
                  {eventTitle(e)}
                </Link>
                <p className="text-sm text-muted">
                  {formatLongDate(e.startAt, e.tz)} · {formatTimeRange(e.startAt, e.endAt, e.tz)}
                  {e.locationText ? ` · ${e.locationText}` : ""}
                </p>
              </div>
              {e.mine.map((m) => (
                <RsvpControl
                  key={m.person.id}
                  eventId={e.id}
                  personId={m.person.id}
                  personName={m.person.firstName}
                  showName={e.mine.length > 1 || true}
                  initial={m.response}
                  initialNote={m.note}
                  size="sm"
                />
              ))}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
