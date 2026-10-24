import type { Metadata } from "next";
import { Handshake, Plus } from "lucide-react";
import { getTeam, listTeamSponsors, manageSponsors } from "@/lib/data";
import { Banner, ButtonLink, EmptyState } from "@/components/ui";
import { SponsorRows } from "@/components/sponsor-admin";
import { SponsorStrip } from "@/components/sponsor-badge";

export const metadata: Metadata = { title: "Sponsors" };

export default async function TeamSponsorsPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [team, m] = await Promise.all([getTeam(teamId), manageSponsors({ teamId })]);
  if (!team || !m) return null;
  if (!m.canManage) return <SponsorStrip sponsors={await listTeamSponsors(teamId)} />;
  return (
    <div className="grid gap-5">
      {sp.saved === "new" && <Banner>Sponsor added. Their contact got an invite to their sponsor page.</Banner>}
      {sp.saved === "1" && <Banner>Saved.</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Sponsors</h2>
          <p className="text-sm text-muted">Sponsors follow your matches and results. They don&apos;t see the roster, chat, answers or dues.</p>
        </div>
        <ButtonLink href={`/t/${teamId}/sponsors/new`} size="sm">
          <Plus aria-hidden />
          Add a sponsor
        </ButtonLink>
      </div>
      {m.sponsors.length === 0 ? (
        <EmptyState icon={<Handshake />} title="No team sponsors yet" hint="Add a local business, pick their tier and they get their own sponsor page." />
      ) : (
        <SponsorRows sponsors={m.sponsors} editBase={`/t/${teamId}/sponsors`} canManage />
      )}
      {m.clubSponsors.length > 0 && <SponsorStrip sponsors={m.clubSponsors} title={`Club sponsors (${team.club?.name})`} />}
    </div>
  );
}
