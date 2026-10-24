import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMatch } from "@/lib/data";
import { eventTitle } from "@/lib/event-title";
import { formatLongDate } from "@/lib/time";
import { MatchDay } from "./match-day";

export const metadata: Metadata = { title: "Match" };

// S20 live score + S21 result and player of the match, in one screen. Scorers see the
// controls; everyone else sees the score update on its own.
export default async function MatchPage({ params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { teamId, eventId } = await params;
  const m = await getMatch(eventId);
  if (!m || m.event.teamId !== teamId) notFound();
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/e/${eventId}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Event
      </Link>
      <p className="text-sm text-muted">
        {eventTitle(m.event)} · {formatLongDate(m.event.startAt, m.event.tz)}
      </p>
      <MatchDay
        eventId={eventId}
        teamName={m.teamName}
        opponent={m.event.opponent ?? "Opponent"}
        homeAway={m.event.homeAway}
        score={m.score}
        feed={m.feed.map((f) => ({ id: f.id, minute: f.minute, kind: f.kind, side: f.side, player: f.player ? `${f.player.firstName} ${f.player.lastName}` : null, assist: f.assist ? `${f.assist.firstName} ${f.assist.lastName}` : null }))}
        squad={m.squad.map((p) => ({ userId: p.userId, name: `${p.person.firstName} ${p.person.lastName}`, jersey: p.jersey }))}
        others={m.others.map((p) => ({ userId: p.userId, name: `${p.person.firstName} ${p.person.lastName}`, jersey: p.jersey }))}
        canScore={m.canScore}
        me={m.me}
        potm={{
          ...m.potm,
          nominees: m.potm.nominees.map((p) => ({ userId: p.userId, name: `${p.person.firstName} ${p.person.lastName}`, jersey: p.jersey })),
          results: m.potm.results?.map((r) => ({ name: `${r.person.firstName} ${r.person.lastName}`, votes: r.votes, winner: r.winner })) ?? null,
        }}
      />
    </div>
  );
}
