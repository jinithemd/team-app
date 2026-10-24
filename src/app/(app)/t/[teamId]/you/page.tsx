import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, getTeam } from "@/lib/data";
import { YourPartForm } from "./your-part-form";

export const metadata: Metadata = { title: "Your part on the team" };

// "Your part on the team": whether you play, your number and position, and your roles.
// Shown right after creating a team, and from the team header any time after.
export default async function YourPartPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [team, user] = await Promise.all([getTeam(teamId), getSessionUser()]);
  if (!team || !user) notFound();
  if (!team.me)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">You&apos;re not on this team&apos;s roster</h2>
        <p className="text-muted">You can see it because you run the club. Add yourself from the roster if you play or help out.</p>
      </div>
    );
  const isNew = !!sp.new;
  return (
    <div className="grid gap-5">
      <div>
        {isNew && <p className="eyebrow">Step 2 of 3</p>}
        <h2 className="text-xl font-bold">Your part on the team</h2>
        <p className="text-sm text-muted">One account covers it all. Pick everything that fits you.</p>
      </div>
      <YourPartForm
        teamId={teamId}
        next={isNew ? `/t/${teamId}/roster?created=1` : `/t/${teamId}/roster?saved=1`}
        submitLabel={isNew ? "Next: add players" : "Save"}
        name={user.firstName}
        clubRole={team.hats.clubRole}
        canChangeRoles={team.canManagePermissions}
        initial={{
          // A brand-new team defaults to "I play and captain it": the usual case for an adult team.
          isPlayer: isNew ? true : team.me.isPlayer,
          jersey: team.me.jersey ?? "",
          position: team.me.position ?? "",
          roles: isNew ? ["captain"] : team.me.roles,
        }}
      />
    </div>
  );
}
