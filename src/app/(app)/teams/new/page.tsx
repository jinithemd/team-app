import type { Metadata } from "next";
import Link from "next/link";
import { listMyClubs } from "@/lib/data";
import { Banner, PageHeader } from "@/components/ui";
import { CreateTeamForm } from "./create-team-form";

export const metadata: Metadata = { title: "Start a team" };

export default async function NewTeamPage({ searchParams }: { searchParams: Promise<{ club?: string; clubCreated?: string }> }) {
  const sp = await searchParams;
  const clubs = (await listMyClubs())
    .filter((c) => c.myRole === "owner" || c.myRole === "admin")
    .map((c) => ({ id: c.id, name: c.name, color: c.color, colorSecondary: c.colorSecondary }));
  const club = clubs.find((c) => c.id === sp.club);
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      {sp.clubCreated && club && <Banner>{club.name} is set up and you&apos;re its owner. Now add its first team.</Banner>}
      <PageHeader title="Start a team" subtitle="Next you'll say whether you play and which roles you hold." />
      <CreateTeamForm clubs={clubs} defaultClubId={club?.id} />
      {!clubs.length && (
        <p className="text-sm text-muted">
          Running several teams?{" "}
          <Link href="/clubs/new" className="font-semibold text-team-ink underline">
            Set up a club first
          </Link>{" "}
          so they share a name, colours and admins.
        </p>
      )}
    </main>
  );
}
