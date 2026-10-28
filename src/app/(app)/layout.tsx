import { redirect } from "next/navigation";
import { getSessionUser, listMyTeams, listPendingRsvps, unreadChatCount } from "@/lib/data";
import { PrimaryNav } from "@/components/nav";
import { TeamThemeStyle } from "@/components/team-theme-style";
import { AppPush } from "@/components/app-bridge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [teams, pending, unread] = await Promise.all([listMyTeams(), listPendingRsvps(), unreadChatCount()]);
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-bg focus:px-3 focus:py-2 focus:outline-2 focus:outline-focus"
      >
        Skip to content
      </a>
      {/* Colour variables for every team the user is on, so team dots and cards outside a team show the right colour. */}
      <TeamThemeStyle teams={teams} enabled={user.useTeamColors} />
      <AppPush />
      <PrimaryNav pendingCount={pending.length} chatCount={unread} />
      <div className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:pb-0">{children}</div>
    </div>
  );
}
