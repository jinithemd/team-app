import { notFound } from "next/navigation";
import { getSessionUser, getTeam, getTeamDues, myPerms } from "@/lib/data";
import { TeamTabs } from "@/components/nav";
import { HatBadges } from "@/components/hats";
import { hatLabels } from "@/lib/data/types";

export default async function TeamLayout({ children, params }: { children: React.ReactNode; params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [team, user] = await Promise.all([getTeam(teamId), getSessionUser()]);
  if (!team) notFound();
  const [perms, dues] = await Promise.all([myPerms(teamId), getTeamDues(teamId)]);
  const hasDues = !!dues && (dues.mine.length > 0 || dues.fees.length > 0);
  const subtitle = [team.club?.name, team.level, team.location].filter(Boolean).join(" · ");
  return (
    // Team colour vars for this id are already emitted by the app layout.
    <div data-team={team.id} className="min-h-full">
      <header className="gutter border-b-4 border-team-2 bg-team pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-4 text-on-team">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {team.settings.crest ? (
            <img src={team.settings.crest} alt="" className="size-12 shrink-0 rounded-lg bg-bg object-cover ring-2 ring-on-team/40" />
          ) : (
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-pill border-2 border-on-team font-display text-lg font-bold">
            {team.name
              .split(/\s+/)
              .filter((w) => /^[A-Za-z]/.test(w))
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-bold break-words uppercase">{team.name}</h1>
            <p className="text-sm opacity-90">{subtitle}</p>
            <div className="mt-1.5">
              <HatBadges labels={hatLabels(team.hats, team.me?.jersey)} onTeam />
            </div>
          </div>
        </div>
      </header>
      <TeamTabs teamId={team.id} show={{ settings: perms.settings, points: team.settings.pointsEnabled && (team.settings.pointsPublic || perms.staff), dues: hasDues || perms.payments }} />
      <main id="main" className="gutter mx-auto max-w-3xl py-5">
        {children}
      </main>
      {!user?.useTeamColors && <span className="sr-only">Team colours are off in your settings.</span>}
    </div>
  );
}
