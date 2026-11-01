"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/*
 * A Back button at the top of every inner screen, so there's always a way back, including in
 * the phone app, where there's no browser back button. It goes to the screen you came from;
 * if you opened this screen straight from a link, it goes up a level instead.
 * The top-level tabs (Home, Teams, Tournaments, Calendar, Chat, Account) don't show it.
 */

const ROOTS = new Set(["/", "/teams", "/tournaments", "/calendar", "/chat", "/account"]);
// Path segments that aren't screens of their own, so "up a level" skips them.
const NOT_PAGES = new Set(["t", "e", "p", "matches", "auction", "pay", "sponsor", "sponsor-chat", "clubs"]);

// The screens visited in this tab, to tell "back" from "up" (shared by every Back bar).
const trail: string[] = [];
function visit(path: string) {
  if (trail[trail.length - 1] === path) return;
  if (trail[trail.length - 2] === path) trail.pop();
  else trail.push(path);
}

function parentOf(path: string): string {
  const parts = path.split("/").filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const last = parts[parts.length - 1];
    if (!NOT_PAGES.has(last)) return "/" + parts.join("/");
  }
  // A team (or club) goes back to Teams.
  if (path.startsWith("/t/") || path.startsWith("/clubs/")) return "/teams";
  if (path.startsWith("/account/")) return "/account";
  return "/";
}

export function BackBar({ tone = "plain", skipTeam = false }: { tone?: "plain" | "team"; skipTeam?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => visit(path), [path]);

  if (ROOTS.has(path)) return null;
  // The app-wide bar steps aside on team screens, which show their own in the team's colours.
  if (skipTeam && path.startsWith("/t/")) return null;

  const back = () => {
    if (trail.length > 1 && trail[trail.length - 1] === path) router.back();
    else router.push(parentOf(path));
  };

  return (
    <div
      data-backbar
      className={`sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)] ${tone === "team" ? "bg-team text-on-team" : "border-b border-border bg-bg/95 text-fg backdrop-blur"}`}
    >
      <div className="gutter mx-auto flex h-11 max-w-3xl items-center">
        <button
          type="button"
          onClick={back}
          className={`-ml-2 inline-flex min-h-10 items-center gap-0.5 rounded-md pr-3 pl-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${tone === "team" ? "hover:bg-on-team/10" : "text-team-ink hover:bg-sunken"}`}
        >
          <ChevronLeft aria-hidden className="size-5" />
          Back
        </button>
      </div>
    </div>
  );
}
