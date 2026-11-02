import { Suspense } from "react";
import { redirect } from "next/navigation";
import { listMyTeams, listPendingRsvps, unreadChatCount } from "@/lib/data";
import { myLook } from "@/lib/data/look";
import { PrimaryNav } from "@/components/nav";
import { TeamThemeStyle } from "@/components/team-theme-style";
import { AppPush } from "@/components/app-bridge";
import { BackBar } from "@/components/back-bar";

// The frame (nav, back bar) goes out straight away; the counts and team colours follow
// once the person's data has loaded, and each page shows its loading screen meanwhile.

async function Nav() {
  const [pending, unread] = await Promise.all([listPendingRsvps(), unreadChatCount()]);
  return <PrimaryNav pendingCount={pending.length} chatCount={unread} />;
}

async function Colours({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <TeamThemeStyle teams={await listMyTeams()} enabled />;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const look = await myLook();
  if (!look.signedIn) redirect("/login");
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-bg focus:px-3 focus:py-2 focus:outline-2 focus:outline-focus"
      >
        Skip to content
      </a>
      {/* Colour variables for every team the user is on, so team dots and cards outside a team show the right colour. */}
      <Suspense fallback={null}>
        <Colours enabled={look.useTeamColors} />
      </Suspense>
      <AppPush />
      <Suspense fallback={<PrimaryNav pendingCount={0} />}>
        <Nav />
      </Suspense>
      <div className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:pb-0">
        <BackBar skipTeam />
        {children}
      </div>
    </div>
  );
}
