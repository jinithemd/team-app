"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TournamentTabs({ id, tableLabel, manage }: { id: string; tableLabel: string; manage: boolean }) {
  const path = usePathname();
  const base = `/tournaments/${id}`;
  const tabs = [
    { href: base, label: "Overview", match: (p: string) => p === base },
    { href: `${base}/fixtures`, label: "Fixtures", match: (p: string) => p.startsWith(`${base}/fixtures`) || p.startsWith(`${base}/matches`) },
    { href: `${base}/table`, label: tableLabel, match: (p: string) => p.startsWith(`${base}/table`) },
    { href: `${base}/teams`, label: "Teams", match: (p: string) => p.startsWith(`${base}/teams`) },
    ...(manage ? [{ href: `${base}/manage`, label: "Manage", match: (p: string) => p.startsWith(`${base}/manage`) }] : []),
  ];
  return (
    <nav aria-label="Tournament sections" className="gutter border-b border-border bg-bg">
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
