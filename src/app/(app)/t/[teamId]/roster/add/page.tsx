import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTeam } from "@/lib/data";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Add to roster" };

export default async function AddRosterPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { teamId } = await params;
  const { kind } = await searchParams;
  const team = await getTeam(teamId);
  if (!team) notFound();
  if (!team.isStaff)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only staff can change the roster</h2>
        <p className="text-muted">Ask your coach to add someone.</p>
      </div>
    );
  const isStaff = kind === "staff";
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/roster${isStaff ? "?tab=staff" : ""}`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Roster
      </Link>
      <div>
        <h2 className="text-xl font-bold">{isStaff ? "Add staff" : "Add players"}</h2>
        <p className="text-sm text-muted">
          {isStaff
            ? "They'll get an email invite. Choose what each person can do."
            : "Each family gets an email invite. Players can be on the schedule right away; families see it once they join."}
        </p>
      </div>
      <InviteForm teamId={teamId} kind={isStaff ? "staff" : "player"} />
    </div>
  );
}
