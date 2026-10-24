import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMember, getTeam } from "@/lib/data";
import { MemberForm } from "./member-form";

export const metadata: Metadata = { title: "Edit roles" };

// S15 staff permissions: one person's roles and what they can do. Any number of people can
// share a role, so a team can have two managers and three coaches.
export default async function MemberPage({ params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  const { teamId, memberId } = await params;
  const [team, m] = await Promise.all([getTeam(teamId), getMember(teamId, memberId)]);
  if (!team) return null;
  if (!m)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only someone who manages permissions can change roles</h2>
        <p className="text-muted">Ask your captain or manager.</p>
      </div>
    );
  const name = `${m.person.firstName} ${m.person.lastName}`;
  return (
    <div className="grid gap-5">
      <Link href={`/t/${teamId}/roster`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Roster
      </Link>
      <div>
        <h2 className="text-xl font-bold break-words">{name}</h2>
        <p className="text-sm break-all text-muted">
          {m.email}
          {m.status === "invited" ? " · invite sent" : ""}
        </p>
      </div>
      <MemberForm
        teamId={teamId}
        memberId={m.id}
        isCreator={m.isCreator}
        initial={{ isPlayer: m.isPlayer, jersey: m.jersey ?? "", position: m.position ?? "", roles: m.roles, permissions: m.permissions }}
      />
    </div>
  );
}
