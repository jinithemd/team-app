import type { Metadata } from "next";
import { getSponsorInvite } from "@/lib/data";
import { teamThemeCss } from "@/lib/team-theme";
import { TierBadge } from "@/components/sponsor-badge";
import { AcceptSponsor } from "./accept";

export const metadata: Metadata = { title: "Your sponsor page" };

export default async function SponsorInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getSponsorInvite(token);
  if (!inv)
    return (
      <main className="gutter mx-auto grid max-w-md gap-3 py-12">
        <h1 className="text-xl font-bold">This sponsor link doesn&apos;t work any more</h1>
        <p className="text-muted">Ask the team to send you a new one.</p>
      </main>
    );
  return (
    <main data-team={inv.themeId} className="min-h-dvh bg-surface">
      <style dangerouslySetInnerHTML={{ __html: teamThemeCss(inv.themeId, inv.color, inv.colorSecondary) }} />
      <div className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+28px)] pb-6 text-on-team">
        <div className="mx-auto grid max-w-md gap-2">
          <p className="text-sm opacity-90">{inv.sponsor.name} is a sponsor of</p>
          <h1 className="font-display text-display leading-none font-bold break-words uppercase">{inv.scopeName}</h1>
          <div>
            <TierBadge tier={inv.sponsor.tier} size="lg" />
          </div>
        </div>
      </div>
      <div className="gutter mx-auto grid max-w-md gap-4 py-6">
        <p>Your sponsor page shows the team&apos;s matches, results and the news they share with sponsors.</p>
        <AcceptSponsor token={token} email={inv.email} hasAccount={inv.hasAccount} />
      </div>
    </main>
  );
}
