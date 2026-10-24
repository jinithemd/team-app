import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTeam } from "@/lib/data";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Add to roster" };

export default async function AddRosterPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) notFound();
  if (!team.isStaff)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only captains and managers can change the roster</h2>
        <p className="text-muted">Ask your captain to add someone.</p>
      </div>
    );
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/roster`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Roster
      </Link>
      <div>
        <h2 className="text-xl font-bold">Add people</h2>
        <p className="text-sm text-muted">Each person gets an email invite to their own account. They&apos;re on the roster straight away and see the schedule once they join.</p>
      </div>
      <p className="rounded-md bg-surface px-3.5 py-3 text-sm">
        Or share the team code <strong className="font-mono text-base tracking-wider">{team.joinCode}</strong>. Anyone with it joins as a player from Teams → Find a team.
      </p>
      <InviteForm teamId={teamId} canGiveRoles={team.canManagePermissions} />
    </div>
  );
}
