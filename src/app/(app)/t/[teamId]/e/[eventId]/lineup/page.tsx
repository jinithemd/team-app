import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { lineupPage } from "@/lib/lineups/service";
import { formatLongDate, formatTime } from "@/lib/time";
import { LineupBuilder } from "./builder";
import { ShareImage } from "../../../share/share-image";

export const metadata: Metadata = { title: "Team sheet" };

export default async function LineupPage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const p = await lineupPage(eventId);
  if (!p || p.event.teamId !== teamId) notFound();
  const when = `${formatLongDate(p.event.startAt, p.event.tz)}, ${formatTime(p.event.startAt, p.event.tz)}`;
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {p.title}
      </Link>
      <div>
        <h2 className="text-xl font-bold">Team sheet</h2>
        <p className="text-sm text-muted">
          {p.title} · {when}
        </p>
      </div>
      {!p.canEdit && !p.saved ? (
        <p className="rounded-lg border border-border p-4 text-muted">The captain hasn&apos;t picked the team yet. It shows up here once they do.</p>
      ) : (
        <LineupBuilder teamId={teamId} eventId={eventId} canEdit={p.canEdit} players={p.players} initial={p.lineup} saved={p.saved} squadSize={p.event.squadSize ?? null} />
      )}
      {p.saved && (
        <section aria-labelledby="share-h" className="grid gap-2">
          <h3 id="share-h" className="font-semibold">
            Share the team
          </h3>
          <p className="text-sm text-muted">A ready-made picture for the team group chat or Instagram.</p>
          <ShareImage
            src={`/api/share/lineup/${eventId}?v=${encodeURIComponent(p.lineup.updatedAt ?? "")}`}
            file={`team-sheet-${eventId.slice(0, 8)}.png`}
            title={`${p.team.name}: ${p.title}`}
            text={`${p.team.name} team sheet: ${p.title}, ${when}`}
            alt={`Team sheet for ${p.title}`}
          />
        </section>
      )}
    </div>
  );
}
