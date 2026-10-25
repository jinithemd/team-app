import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { getInviteLink, getTeam } from "@/lib/data";
import { InviteForm } from "./invite-form";
import { InviteLink } from "./invite-link";

export const metadata: Metadata = { title: "Add to roster" };

export default async function AddRosterPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [team, link] = await Promise.all([getTeam(teamId), getInviteLink(teamId)]);
  if (!team) notFound();
  const qrSvg = link ? await QRCode.toString(link.url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }) : "";
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
        <p className="text-sm text-muted">Share the team&apos;s invite link, or add people by email below. Each person you add by email gets an invite to their own account. They&apos;re on the roster straight away and see the schedule once they join.</p>
      </div>
      {link && <InviteLink teamId={teamId} teamName={team.name} url={link.url} needsApproval={link.needsApproval} qrSvg={qrSvg} />}
      <p className="rounded-md bg-surface px-3.5 py-3 text-sm">
        Or share the team code <strong className="font-mono text-base tracking-wider">{team.joinCode}</strong>. Anyone with it joins as a player from Teams → Find a team.
      </p>
      <InviteForm teamId={teamId} canGiveRoles={team.canManagePermissions} />
    </div>
  );
}
