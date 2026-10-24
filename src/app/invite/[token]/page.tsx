import type { Metadata } from "next";
import { getInvite, getSessionUser } from "@/lib/data";
import { teamThemeCss } from "@/lib/team-theme";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Join the team" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([getInvite(token), getSessionUser()]);
  if (!invite)
    return (
      <main className="gutter mx-auto grid max-w-md gap-3 py-12">
        <h1 className="text-xl font-bold">This invite link doesn&apos;t work any more</h1>
        <p className="text-muted">It may have expired or been cancelled. Ask the coach to send you a new one.</p>
      </main>
    );
  const signedInAsOther = user && user.email !== invite.email;
  return (
    <main data-team={invite.team.id} className="min-h-dvh bg-surface">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(invite.team.id, invite.team.color, invite.team.colorSecondary) }} />
      <div className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+28px)] pb-6 text-on-team">
        <div className="mx-auto max-w-md">
          <p className="text-sm opacity-90">You&apos;re invited to</p>
          <h1 className="font-display text-display leading-none font-bold uppercase break-words">{invite.team.name}</h1>
        </div>
      </div>
      <div className="gutter mx-auto grid max-w-md gap-4 py-6">
        <p>
          {invite.kind === "staff"
            ? "Join as staff to see the schedule, the roster and who's coming."
            : invite.forChild
              ? `${invite.person.firstName} ${invite.person.lastName} is on the roster. Join to see the schedule and answer for games and practices.`
              : "You're on the roster. Join to see the schedule and answer for games and practices."}
        </p>
        {invite.accepted && !signedInAsOther ? (
          <a href={`/t/${invite.team.id}/schedule`} className="font-semibold text-team-ink underline">
            You&apos;ve already joined. Open the team.
          </a>
        ) : (
          <AcceptForm token={token} email={invite.email} hasAccount={invite.hasAccount} signedInAsOther={!!signedInAsOther} />
        )}
      </div>
    </main>
  );
}
