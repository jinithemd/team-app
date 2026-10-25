import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser, listMyHats } from "@/lib/data";
import { HatBadges } from "@/components/hats";
import { CLUB_ROLE_LABEL } from "@/lib/data/types";
import { signOutAction, updatePreferencesAction } from "@/app/actions";
import { Avatar, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const [user0, hats] = await Promise.all([getSessionUser(), listMyHats()]);
  const user = user0!;
  const name = `${user.firstName} ${user.lastName}`;
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-6 py-6">
      <PageHeader title="Account" />
      <section className="flex items-center gap-3">
        <Avatar name={name} size={64} />
        <div className="min-w-0">
          <p className="text-lg font-semibold break-words">{name}</p>
          <p className="text-sm break-all text-muted">{user.email}</p>
        </div>
      </section>

      <section aria-labelledby="hats-h" className="grid gap-3 rounded-lg border border-border p-4">
        <div>
          <h2 id="hats-h" className="text-lg font-semibold">
            Your roles
          </h2>
          <p className="text-sm text-muted">One account for everything you do.</p>
        </div>
        <ul className="grid gap-2.5">
          {hats.clubs.map((c) => (
            <li key={c.clubId} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{c.name}</span>
              <HatBadges labels={[CLUB_ROLE_LABEL[c.role]]} />
            </li>
          ))}
          {hats.teams.map((t) => (
            <li key={t.teamId} data-team={t.teamId} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/t/${t.teamId}/you`} className="font-semibold text-fg hover:underline">
                {t.name}
              </Link>
              <HatBadges labels={t.labels} />
            </li>
          ))}
          {!hats.clubs.length && !hats.teams.length && <li className="text-sm text-muted">You&apos;re not on a team yet.</li>}
        </ul>
        <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-sm font-semibold">
          <Link href="/teams/new" className="text-team-ink">
            Start a team
          </Link>
          <Link href="/clubs/new" className="text-team-ink">
            Set up a club
          </Link>
          <Link href="/availability" className="text-team-ink">
            Unavailable dates
          </Link>
          <Link href="/account/notifications" className="text-team-ink">
            Notifications
          </Link>
          <Link href="/calendar/subscribe" className="text-team-ink">
            Add to your phone&apos;s calendar
          </Link>
        </div>
      </section>

      <section aria-labelledby="look-h" className="grid gap-4 rounded-lg border border-border p-4">
        <h2 id="look-h" className="text-lg font-semibold">
          Look
        </h2>
        <form action={updatePreferencesAction} className="grid gap-2">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Light or dark</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["system", "Match my phone"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  name="theme"
                  value={v}
                  aria-pressed={user.theme === v}
                  className={`min-h-10 rounded-pill border px-4 text-sm font-semibold ${user.theme === v ? "border-fg bg-fg text-bg" : "border-border-input hover:bg-surface"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </form>
        <form action={updatePreferencesAction} className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-sm font-semibold">Team colours</p>
            <p className="text-sm text-muted">Show each team in its own colours. Turn off to use the app&apos;s standard colours everywhere.</p>
          </div>
          <button
            name="useTeamColors"
            value={user.useTeamColors ? "off" : "on"}
            role="switch"
            aria-checked={user.useTeamColors}
            aria-label="Team colours"
            className={`relative h-8 w-13 shrink-0 rounded-pill transition-colors ${user.useTeamColors ? "bg-accent" : "bg-border-input"}`}
          >
            <span aria-hidden className={`absolute top-1 size-6 rounded-pill bg-bg shadow-card transition-[left] ${user.useTeamColors ? "left-6" : "left-1"}`} />
          </button>
        </form>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={signOutAction}>
          <button className={buttonClass("secondary")}>Sign out</button>
        </form>
        <Link href="/account/delete" className="text-sm font-semibold text-danger hover:underline">
          Delete my account
        </Link>
      </div>
      <p className="text-xs text-muted">
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </p>
    </main>
  );
}
