import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auctionView } from "@/lib/auction/service";
import { getTeam } from "@/lib/data";
import { teamThemeCss } from "@/lib/team-theme";
import { AuctionRoom } from "./room";

export const metadata: Metadata = { title: "Auction" };
export const dynamic = "force-dynamic";

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await auctionView((await params).id);
  if (!v) notFound();
  const team = await getTeam(v.auction.teamId).catch(() => null);
  return (
    <main id="main" className="gutter mx-auto max-w-3xl py-6" data-team={v.auction.teamId}>
      {team && <style dangerouslySetInnerHTML={{ __html: teamThemeCss(team.id, team.color, team.colorSecondary) }} />}
      <AuctionRoom initial={v} teamName={team?.name ?? "Team"} />
    </main>
  );
}
