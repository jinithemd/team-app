import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAvailability, getEvent } from "@/lib/data";
import { Counts, RSVP_LABEL } from "@/components/event-bits";
import { Avatar } from "@/components/ui";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate } from "@/lib/time";
import type { RsvpResponse } from "@/lib/data/types";

export const metadata: Metadata = { title: "Who's coming" };

export default async function AvailabilityPage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const [e, a] = await Promise.all([getEvent(eventId), getAvailability(eventId)]);
  if (!e || !a || e.teamId !== teamId) notFound();
  const groups: { key: RsvpResponse | "none"; label: string }[] = [
    { key: "going", label: RSVP_LABEL.going },
    { key: "maybe", label: RSVP_LABEL.maybe },
    { key: "not_going", label: RSVP_LABEL.not_going },
    { key: "none", label: "No answer yet" },
  ];
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {eventTitle(e)}
      </Link>
      <div>
        <h2 className="text-xl font-bold">Who&apos;s coming</h2>
        <p className="text-sm text-muted">
          {eventTitle(e)} · {formatLongDate(e.startAt, e.tz)}
        </p>
      </div>
      <Counts counts={a.counts} />
      {a.canSeeNotes && <p className="text-xs text-muted">Notes are only visible to captains and managers.</p>}
      {groups.map((gr) => {
        const rows = a.rows.filter((r) => (r.response ?? "none") === gr.key);
        if (!rows.length) return null;
        return (
          <section key={gr.key} aria-labelledby={`g-${gr.key}`} className="grid">
            <h3 id={`g-${gr.key}`} className="eyebrow mb-1">
              {gr.label} · {rows.length}
            </h3>
            <ul>
              {rows.map((r) => (
                <li key={r.person.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                  <span className="w-7 text-center font-display text-lg font-bold text-team-ink tabular" aria-label={r.jersey ? `Number ${r.jersey}` : undefined}>
                    {r.jersey}
                  </span>
                  <Avatar name={`${r.person.firstName} ${r.person.lastName}`} size={32} src={r.person.photo} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">
                      {r.person.firstName} {r.person.lastName}
                    </p>
                    {r.note && <p className="text-sm text-muted italic break-words">&ldquo;{r.note}&rdquo;</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
