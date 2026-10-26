import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hostableClubs } from "@/lib/tournaments/service";
import { PageHeader } from "@/components/ui";
import { TournamentForm } from "@/components/tournament/tournament-form";

export const metadata: Metadata = { title: "Host a tournament" };

export default async function NewTournamentPage() {
  const clubs = await hostableClubs();
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-5 py-6">
      <Link href="/tournaments" className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Tournaments
      </Link>
      <PageHeader title="Host a tournament" subtitle="Set it up, then invite teams. You can change everything until the fixtures are made." />
      {clubs.length ? (
        <TournamentForm clubs={clubs} />
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
