import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTournament } from "@/lib/tournaments/service";
import { EVENT_LABEL } from "@/lib/tournaments/types";
import { FixtureRow } from "@/components/tournament/bits";
import { EventForm, RemoveEvent, ResultForm } from "./match-forms";

export default async function MatchPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const v = await getTournament(id);
  if (!v) notFound();
  const m = v.matches.find((x) => x.id === matchId);
  if (!m) notFound();
  const canEdit = v.role !== "viewer";
  const teamName = (entryId: string) => v.entries.find((e) => e.id === entryId)?.name ?? "";
  const ready = !!m.homeId && !!m.awayId;
  return (
    <>
      <Link href={`/tournaments/${id}/fixtures`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Fixtures
      </Link>
      <h2 className="eyebrow">{m.roundName ?? `Round ${m.round}`}</h2>
      <FixtureRow m={m} />

      {canEdit && (
        <ResultForm
          id={id}
          matchId={m.id}
          knockout={m.stage === "knockout"}
          ready={ready}
          home={m.homeLabel}
          away={m.awayLabel}
          initial={{
            status: m.status,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            homePens: m.homePens,
            awayPens: m.awayPens,
            kickoffAt: m.kickoffAt,
            pitch: m.pitch ?? "",
          }}
        />
      )}

      <section aria-labelledby="ev-h" className="grid gap-2">
        <h2 id="ev-h" className="text-lg font-semibold">
          Goals and cards
        </h2>
        {m.events.length === 0 && <p className="text-sm text-muted">Nothing recorded yet.</p>}
        <ul className="grid gap-1.5">
          {[...m.events]
            .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))
            .map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="w-10 shrink-0 text-muted tabular">{e.minute != null ? `${e.minute}′` : "–"}</span>
                <span aria-hidden className={`size-3 shrink-0 rounded-sm ${e.kind === "yellow" ? "bg-warning" : e.kind === "red" ? "bg-danger" : "bg-fg"}`} />
                <span className="min-w-0 flex-1">
                  <strong>{EVENT_LABEL[e.kind]}</strong>
                  {e.player ? ` · ${e.player}` : ""} <span className="text-muted">({teamName(e.entryId)})</span>
                </span>
                {canEdit && <RemoveEvent id={id} eventId={e.id} />}
              </li>
            ))}
        </ul>
        {canEdit && ready && (
          <EventForm
            id={id}
            matchId={m.id}
            teams={[
              { id: m.homeId!, name: m.homeLabel },
              { id: m.awayId!, name: m.awayLabel },
            ]}
          />
        )}
      </section>
    </>
  );
}
