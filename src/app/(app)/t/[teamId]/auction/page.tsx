import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Gavel } from "lucide-react";
import { teamAuctions } from "@/lib/auction/service";
import { listRoster } from "@/lib/data";
import { EmptyState } from "@/components/ui";
import { NewAuctionForm } from "./new-auction-form";

export const metadata: Metadata = { title: "Auction" };
export const dynamic = "force-dynamic";

const STATUS = { setup: ["Setting up", "bg-sunken text-muted"], live: ["Live now", "bg-danger-soft text-danger"], done: ["Finished", "bg-success-soft text-success"] } as const;

export default async function AuctionTab({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const v = await teamAuctions(teamId);
  if (!v) notFound();
  const roster = v.host ? await listRoster(teamId).catch(() => []) : [];
  const players = roster.filter((r) => r.status === "active" && r.userId).length;
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Gavel aria-hidden className="size-5" />
          Player auction
        </h2>
        <p className="text-sm text-muted">Pick teams for an internal tournament the fun way: captains bid points for players.</p>
      </div>
      {v.auctions.length > 0 ? (
        <ul className="grid gap-2">
          {v.auctions.map((a) => (
            <li key={a.id}>
              <Link href={`/auction/${a.id}`} className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block text-sm text-muted">
                    {a.budget} points per team · base {a.basePrice}
                  </span>
                </span>
                <span className={`rounded-pill px-2 py-0.5 text-[11px] font-bold tracking-[.04em] uppercase ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
                <ChevronRight aria-hidden className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !v.host && <EmptyState icon={<Gavel />} title="No auctions yet" hint="When your captains run a player auction, you can watch it live here." />
      )}
      {v.host && <NewAuctionForm teamId={teamId} players={players} />}
    </div>
  );
}
