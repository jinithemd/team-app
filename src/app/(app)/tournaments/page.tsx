import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Trophy } from "lucide-react";
import { listMyTournaments } from "@/lib/tournaments/service";
import { FORMAT_LABEL } from "@/lib/tournaments/engine";
import { Banner, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { StatusPill, TournamentLogo, fmtDates } from "@/components/tournament/bits";
import { InviteAnswer } from "./invite-answer";

export const metadata: Metadata = { title: "Tournaments" };

type Card = Awaited<ReturnType<typeof listMyTournaments>>["hosting"][number];

function TournamentCard({ c, note }: { c: Card; note?: string }) {
  return (
    <Link href={`/tournaments/${c.t.id}`} className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-focus">
      <TournamentLogo url={c.logoUrl} name={c.t.name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold break-words">{c.t.name}</span>
        <span className="block text-sm text-muted">
          {[c.clubName, fmtDates(c.t), FORMAT_LABEL[c.t.format]].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <StatusPill status={c.t.status} />
          {note && <span className="text-xs text-muted">{note}</span>}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const sp = await searchParams;
  const { canHost, hosting, playing, invitations } = await listMyTournaments();
  const nothing = !hosting.length && !playing.length && !invitations.length;
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 py-6">
      <PageHeader
        title="Tournaments"
        subtitle="Cups, leagues and festivals your club hosts or your teams play in."
        action={
          canHost ? (
            <ButtonLink href="/tournaments/new">
              <Plus aria-hidden />
              Host a tournament
            </ButtonLink>
          ) : undefined
        }
      />
      {sp.deleted && <Banner>Tournament deleted.</Banner>}

      {invitations.length > 0 && (
        <section aria-labelledby="inv-h" className="grid gap-2">
          <h2 id="inv-h" className="eyebrow">
            Invitations
          </h2>
          <ul className="grid gap-2">
            {invitations.map((c) => (
              <li key={c.invite.entryId} className="grid gap-2 rounded-lg border-2 border-team p-3">
                <TournamentCard c={c} note={`${c.invite.teamName} is invited`} />
                <InviteAnswer entryId={c.invite.entryId} teamName={c.invite.teamName} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {hosting.length > 0 && (
        <section aria-labelledby="host-h" className="grid gap-2">
          <h2 id="host-h" className="eyebrow">
            Hosting
          </h2>
          <ul className="grid gap-2">
            {hosting.map((c) => (
              <li key={c.t.id}>
                <TournamentCard c={c} note="You run this" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {playing.length > 0 && (
        <section aria-labelledby="play-h" className="grid gap-2">
          <h2 id="play-h" className="eyebrow">
            Playing in
          </h2>
          <ul className="grid gap-2">
            {playing.map((c) => (
              <li key={c.t.id}>
                <TournamentCard c={c} note={c.mine.map((m) => (m.status === "applied" ? `${m.teamName}: waiting for the organizers` : m.teamName)).join(" · ")} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {nothing && (
        <EmptyState
          icon={<Trophy />}
          title="No tournaments yet"
          hint={
            canHost
              ? "Host one for your club: pick a format, invite teams, and the fixtures and table look after themselves."
              : "When a club invites one of your teams, the invitation shows up here. Club owners and admins can host tournaments."
          }
        />
      )}
    </main>
  );
}
