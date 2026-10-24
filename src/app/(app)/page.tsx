import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CalendarPlus, ChevronRight, Plus, Users } from "lucide-react";
import { getSessionUser, listMyAvailability, listMyTeams, listPendingRsvps, listUpcomingForMe } from "@/lib/data";
import { EventCard } from "@/components/event-bits";
import { ButtonLink, EmptyState, SectionTitle } from "@/components/ui";
import { hatLabels } from "@/lib/data/types";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const [user, teams, upcoming, pending, avail] = await Promise.all([getSessionUser(), listMyTeams(), listUpcomingForMe(6), listPendingRsvps(), listMyAvailability()]);
  const out = avail.periods[0];
  const fmtDay = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00Z"));
  const staffTeams = teams.filter((t) => t.isStaff);
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-7 py-6">
      <header>
        <p className="text-sm text-muted">Hi {user!.firstName}</p>
        <h1 className="text-xl font-bold">
          {pending.length
            ? `${pending.length} ${pending.length === 1 ? "event needs" : "events need"} your answer`
            : upcoming.length
              ? "You're all caught up"
              : "Welcome"}
        </h1>
      </header>

      {teams.length > 0 && (
        <section aria-labelledby="teams-h" className="grid gap-3">
          <SectionTitle
            action={
              <Link href="/teams" className="text-sm font-semibold text-team-ink">
                All teams
              </Link>
            }
          >
            <span id="teams-h">Your teams</span>
          </SectionTitle>
          <ul className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
            {teams.map((t) => (
              <li key={t.id} data-team={t.id} className="snap-start">
                <Link
                  href={`/t/${t.id}/schedule`}
                  className="flex min-h-16 w-56 items-center gap-3 rounded-lg border-b-4 border-team-2 bg-team px-3.5 py-3 text-on-team focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg leading-tight font-bold uppercase">{t.name}</span>
                    <span className="block truncate text-xs opacity-90">
                      {hatLabels(t.hats, t.me?.jersey).join(" · ")}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {out ? (
        <Link href="/availability" className="flex items-center gap-2.5 rounded-md bg-warning-soft px-3.5 py-3 text-sm">
          <AlertCircle aria-hidden className="size-[18px] shrink-0 text-warning" />
          <span className="flex-1">
            You&apos;re marked <strong>{out.kind === "injured" ? "injured" : out.kind === "away" ? "away" : "unavailable"}</strong> {fmtDay(out.startsOn)} – {fmtDay(out.endsOn)}. Teammates just see unavailable.
          </span>
          <span className="font-semibold text-team-ink">Change</span>
        </Link>
      ) : (
        avail.teams.length > 0 && (
          <Link href="/availability" className="-mt-3 justify-self-start text-sm font-semibold text-team-ink">
            Injured or away? Mark your dates
          </Link>
        )
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pending-h" className="grid gap-3">
          <SectionTitle
            action={
              <Link href="/rsvps" className="text-sm font-semibold text-team-ink">
                Answer all
              </Link>
            }
          >
            <span id="pending-h">Needs your answer</span>
          </SectionTitle>
          <div className="grid gap-2.5">
            {pending.slice(0, 3).map((e) => (
              <EventCard key={e.id} e={e} showTeam />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="up-h" className="grid gap-3">
        <SectionTitle
          action={
            upcoming.length > 0 && (
              <Link href="/calendar" className="text-sm font-semibold text-team-ink">
                Full calendar
              </Link>
            )
          }
        >
          <span id="up-h">Coming up</span>
        </SectionTitle>
        {upcoming.length ? (
          <div className="grid gap-2.5">
            {upcoming.map((e) => (
              <EventCard key={e.id} e={e} showTeam={teams.length > 1} />
            ))}
          </div>
        ) : teams.length ? (
          <EmptyState
            icon={<CalendarPlus />}
            title="Nothing on the schedule yet"
            hint={staffTeams.length ? "Add a game or training and your team gets a heads-up." : "Your captains haven't added any games or trainings yet."}
            action={
              staffTeams[0] && (
                <ButtonLink href={`/t/${staffTeams[0].id}/e/new`} size="sm">
                  <Plus aria-hidden />
                  New event
                </ButtonLink>
              )
            }
          />
        ) : (
          <EmptyState
            icon={<Users />}
            title="You're not on a team yet"
            hint="Start a team or a club, or open the invite link from your captain."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/teams/new" size="sm">
                  <Plus aria-hidden />
                  Start a team
                </ButtonLink>
                <ButtonLink href="/clubs/new" variant="secondary" size="sm">
                  Set up a club
                </ButtonLink>
              </div>
            }
          />
        )}
      </section>
    </main>
  );
}
