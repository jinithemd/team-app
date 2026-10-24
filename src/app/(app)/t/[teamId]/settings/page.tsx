import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin, CalendarRange } from "lucide-react";
import { getTeam, myPerms } from "@/lib/data";
import { TeamSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Team settings" };

export default async function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [team, perms] = await Promise.all([getTeam(teamId), myPerms(teamId)]);
  if (!team) return null;
  if (!perms.settings)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-bold">Only managers can change team settings</h2>
        <p className="text-muted">Ask your manager or captain.</p>
      </div>
    );
  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-bold">Team settings</h2>
      <nav aria-label="More settings" className="grid gap-2 sm:grid-cols-2">
        {[
          [`/t/${teamId}/venues`, "Venues and map pins", <MapPin key="i" aria-hidden />],
          [`/t/${teamId}/seasons`, "Seasons", <CalendarRange key="i" aria-hidden />],
        ].map(([href, label, icon]) => (
          <Link
            key={href as string}
            href={href as string}
            className="flex min-h-12 items-center gap-3 rounded-md border border-border px-3.5 text-sm font-semibold hover:bg-surface [&_svg]:size-[18px]"
          >
            {icon}
            <span className="flex-1">{label}</span>
            <ChevronRight aria-hidden className="text-muted" />
          </Link>
        ))}
      </nav>
      <TeamSettingsForm
        teamId={teamId}
        initial={{
          name: team.name,
          level: team.level ?? "",
          location: team.location ?? "",
          color: team.color,
          colorSecondary: team.colorSecondary,
          rosterVisible: team.rosterVisible,
          ...team.settings,
        }}
        clubName={team.club?.name ?? null}
      />
    </div>
  );
}
