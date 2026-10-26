import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTeam, myPerms } from "@/lib/data";
import { SponsorForm } from "@/components/sponsor-admin";

export const metadata: Metadata = { title: "Add a sponsor" };

export default async function NewTeamSponsor({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [team, perms] = await Promise.all([getTeam(teamId), myPerms(teamId)]);
  if (!team) return null;
  if (!perms.settings) return <p className="text-muted">Only whoever runs the team can add sponsors.</p>;
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/sponsors`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Sponsors
      </Link>
      <h2 className="text-xl font-bold">Add a sponsor</h2>
      <SponsorForm scope={{ teamId }} id={null} back={`/t/${teamId}/sponsors`} initial={{ name: "", tier: null, website: "", blurb: "", email: "", startsOn: "", endsOn: "", logo: null }} />
    </div>
  );
}
