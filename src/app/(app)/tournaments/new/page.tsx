import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hostableClubs } from "@/lib/tournaments/service";
import { getSessionUser, listMyTeams } from "@/lib/data";
import { Banner } from "@/components/ui";
import { ClubFromTeam } from "./club-from-team";
import { PageHeader } from "@/components/ui";
import { TournamentForm } from "@/components/tournament/tournament-form";

export const metadata: Metadata = { title: "Host a tournament" };

export default async function NewTournamentPage({ searchParams }: { searchParams: Promise<{ club?: string }> }) {
  const sp = await searchParams;
  const [clubs, teams, me] = await Promise.all([hostableClubs(), listMyTeams(), getSessionUser()]);
  // Teams I run that aren't in a club yet: one tap turns one into a club.
  const clubless = teams.filter((t) => !t.club && (t.createdBy === me?.id || t.me?.permissions.includes("edit_settings"))).map((t) => ({ id: t.id, name: t.name }));
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-5 py-6">
      <Link href="/tournaments" className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Tournaments
      </Link>
      <PageHeader title="Host a tournament" subtitle="Set it up, then invite teams. You can change everything until the fixtures are made." />
      {sp.club && clubs.length > 0 && <Banner>Your club is set up and your team is in it. Now set up the tournament.</Banner>}
      {clubs.length ? (
        <TournamentForm clubs={clubs} />
      ) : clubless.length ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold">First, make your team a club</h2>
          <p className="text-sm text-muted">
            Tournaments are hosted by a club. If your team is your club, we&apos;ll set one up with the same name, colours and crest, make you its owner,
            and put your team in it. You can add more teams to the club later.
          </p>
          <ClubFromTeam teams={clubless} />
          <p className="text-xs text-muted">
            Or{" "}
            <Link href="/clubs/new" className="font-semibold text-team-ink underline">
              set up a club with a different name
            </Link>
            .
          </p>
        </section>
      ) : (
        <p className="rounded-lg border border-border p-4 text-sm">
          Tournaments are hosted by clubs. Only a club&apos;s owner or admins can host one.{" "}
          <Link href="/clubs/new" className="font-semibold text-team-ink underline">
            Set up a club
          </Link>
        </p>
      )}
    </main>
  );
}
