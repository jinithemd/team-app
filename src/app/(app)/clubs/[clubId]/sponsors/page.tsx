import type { Metadata } from "next";
import { Handshake, Plus } from "lucide-react";
import { manageSponsors } from "@/lib/data";
import { Banner, ButtonLink, EmptyState } from "@/components/ui";
import { SponsorRows } from "@/components/sponsor-admin";

export const metadata: Metadata = { title: "Club sponsors" };

// Club sponsors back every club team and appear on every team's sponsor strip.
export default async function ClubSponsorsPage({ params, searchParams }: { params: Promise<{ clubId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { clubId } = await params;
  const sp = await searchParams;
  const m = await manageSponsors({ clubId });
  if (!m?.canManage) return <p className="text-muted">Only the club owner or admins can manage club sponsors.</p>;
  return (
    <div className="grid gap-5">
      {sp.saved === "new" && <Banner>Sponsor added. Their contact got an invite to their sponsor page.</Banner>}
      {sp.saved === "1" && <Banner>Saved.</Banner>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Club sponsors</h2>
          <p className="text-sm text-muted">They show on every club team and the club page, and follow every team&apos;s matches and results.</p>
        </div>
        <ButtonLink href={`/clubs/${clubId}/sponsors/new`} size="sm">
          <Plus aria-hidden />
          Add a sponsor
        </ButtonLink>
      </div>
      {m.sponsors.length === 0 ? (
        <EmptyState icon={<Handshake />} title="No club sponsors yet" hint="Each team can also have its own sponsors." />
      ) : (
        <SponsorRows sponsors={m.sponsors} editBase={`/clubs/${clubId}/sponsors`} canManage />
      )}
    </div>
  );
}
