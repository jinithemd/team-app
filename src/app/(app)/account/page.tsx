import type { Metadata } from "next";
import { getSessionUser } from "@/lib/data";
import { signOutAction, updatePreferencesAction } from "@/app/actions";
import { Avatar, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = (await getSessionUser())!;
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

      <form action={signOutAction}>
        <button className={buttonClass("secondary")}>Sign out</button>
      </form>
    </main>
  );
}
