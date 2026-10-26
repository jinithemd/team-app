"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, MessageCircle, User, Users, Trophy } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

const ITEMS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/rsvps") },
  // On phones Tournaments lives under Teams (five tabs fit); the desktop sidebar lists it.
  { href: "/teams", label: "Teams", icon: Users, match: (p: string) => p.startsWith("/teams") || p.startsWith("/t/") || p.startsWith("/tournaments") },
  { href: "/tournaments", label: "Tournaments", icon: Trophy, match: (p: string) => p.startsWith("/tournaments"), desktopOnly: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { href: "/chat", label: "Chat", icon: MessageCircle, match: (p: string) => p.startsWith("/chat") },
  { href: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") },
];

/** Bottom tab bar under lg, left sidebar at lg and up. */
export function PrimaryNav({ pendingCount, chatCount = 0 }: { pendingCount: number; chatCount?: number }) {
  const path = usePathname();
  return (
    <>
      <nav
        aria-label="Primary"
        className="pb-safe gutter fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {ITEMS.filter((i) => !("desktopOnly" in i)).map(({ href, label, icon: Icon, match }) => {
            const active = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative grid min-h-14 justify-items-center gap-0.5 pt-2 pb-2.5 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                    active ? "text-team-ink" : "text-muted"
                  }`}
                >
                  {active && <span aria-hidden className="absolute inset-x-[30%] top-0 h-0.5 rounded-pill bg-team-ink" />}
                  <Icon aria-hidden className="size-[22px]" />
                  {label}
                  {href === "/chat" && chatCount > 0 && (
                    <>
                      <span aria-hidden className="absolute top-1 left-[calc(50%+6px)] grid h-4 min-w-4 place-items-center rounded-pill bg-danger px-1 text-[10px] font-bold text-on-danger tabular">
                        {chatCount}
                      </span>
                      <span className="sr-only">, {chatCount} unread</span>
                    </>
                  )}
                  {href === "/" && pendingCount > 0 && (
                    <>
                      <span aria-hidden className="absolute top-1 left-[calc(50%+6px)] grid h-4 min-w-4 place-items-center rounded-pill bg-danger px-1 text-[10px] font-bold text-on-danger tabular">
                        {pendingCount}
                      </span>
                      <span className="sr-only">, {pendingCount} waiting for your answer</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="Primary" className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="mb-4 inline-flex self-start rounded-md bg-[#06080D] px-3.5 py-2.5">
          <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-5 w-auto" />
        </Link>
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = href === "/teams" ? match(path) && !path.startsWith("/tournaments") : match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${
                active ? "bg-team-soft text-team-ink" : "text-muted hover:bg-sunken hover:text-fg"
              }`}
            >
              <Icon aria-hidden className="size-5" />
              <span className="flex-1">{label}</span>
              {href === "/chat" && chatCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-pill bg-danger px-1.5 text-[11px] font-bold text-on-danger tabular">
                  {chatCount}
                  <span className="sr-only"> unread</span>
                </span>
              )}
              {href === "/" && pendingCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-pill bg-danger px-1.5 text-[11px] font-bold text-on-danger tabular">
                  {pendingCount}
                  <span className="sr-only"> waiting for your answer</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function TeamTabs({ teamId, show = {} }: { teamId: string; show?: { points?: boolean; dues?: boolean; settings?: boolean } }) {
  const path = usePathname();
  const tabs = [
    { href: `/t/${teamId}/schedule`, label: "Schedule", match: (p: string) => p.includes("/schedule") || p.includes("/e/") },
    { href: `/t/${teamId}/roster`, label: "Roster", match: (p: string) => p.includes("/roster") || p.includes("/you") || p.includes("/p/") },
    { href: `/t/${teamId}/chat`, label: "Chat", match: (p: string) => p.includes("/chat") },
    ...(show.points ? [{ href: `/t/${teamId}/points`, label: "Points", match: (p: string) => p.includes("/points") || p.includes("/seasons") }] : []),
    ...(show.dues ? [{ href: `/t/${teamId}/dues`, label: "Dues", match: (p: string) => p.includes("/dues") }] : []),
    { href: `/t/${teamId}/messages`, label: "Messages", match: (p: string) => p.includes("/messages") },
    ...(show.settings ? [{ href: `/t/${teamId}/settings`, label: "Settings", match: (p: string) => p.includes("/settings") || p.includes("/venues") }] : []),
  ];
  return (
    <nav aria-label="Team sections" className="gutter border-b border-border bg-bg">
      <ul className="mx-auto flex max-w-3xl gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.match(path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-12 items-center border-b-2 px-2.5 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                  active ? "border-team-ink text-team-ink" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
