import type { Metadata } from "next";
import Link from "next/link";
import { getClubStats } from "@/lib/data";

export const metadata: Metadata = { title: "Club dashboard" };

const money = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(c / 100);
const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const short = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

// Club stats: attendance trend and by team, how early people answer, dues, carpools.
// One series per chart, in the club colour; every bar has a tooltip and the data has a table.
export default async function ClubStatsPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const s = await getClubStats(clubId);
  if (!s) return null;
  const pct = s.dues.total ? Math.round((s.dues.collected / s.dues.total) * 100) : null;
  return (
    <div className="grid gap-7">
      <div className="grid gap-1">
        <h2 className="text-xl font-bold">Club dashboard</h2>
        <p className="text-sm text-muted">Every team in the club at a glance. Only club admins see this.</p>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Club at a glance">
        {[
          [s.overview.people, "members", `${s.overview.players} players · ${s.overview.staff} staff`],
          [s.overview.upcoming7, "events this week", `${s.upcoming.length ? "next: " + when(s.upcoming[0].startAt) : "nothing scheduled"}`],
          [s.overview.invited + s.overview.joinRequests, "waiting to join", `${s.overview.invited} invited · ${s.overview.joinRequests} asked`],
          [s.overview.sponsors, "active sponsors", null],
        ].map(([n, l, note]) => (
          <li key={String(l)} className="grid content-start gap-0.5 rounded-lg border border-border p-3">
            <p className="font-display text-3xl leading-none font-bold tabular">{n}</p>
            <p className="text-sm font-semibold">{l}</p>
            {note && <p className="text-xs text-muted">{note}</p>}
          </li>
        ))}
      </ul>

      <section aria-labelledby="up-h" className="grid gap-2">
        <h3 id="up-h" className="font-semibold">
          Coming up
        </h3>
        {s.upcoming.length === 0 ? (
          <p className="text-sm text-muted">No events scheduled in any team.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {s.upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/t/${e.teamId}/e/${e.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 hover:bg-sunken">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {e.team} · {when(e.startAt)}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <strong className="tabular">{e.going}</strong>
                    <span className="text-muted">/{e.squad} in</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="teams-h" className="grid gap-2">
        <h3 id="teams-h" className="font-semibold">
          Teams
        </h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Team</th>
                <th className="px-3 py-2 text-right font-semibold">Members</th>
                <th className="px-3 py-2 text-right font-semibold">Players</th>
                <th className="px-3 py-2 text-right font-semibold">Upcoming</th>
                <th className="px-3 py-2 font-semibold">Next event</th>
              </tr>
            </thead>
            <tbody>
              {s.teamRows.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/t/${t.id}`} className="font-semibold whitespace-nowrap text-team-ink hover:underline" title={t.name}>
                      {t.name.replace(s.club.name.replace(/ FC$/, ""), "").trim() || t.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{t.members}</td>
                  <td className="px-3 py-2 text-right tabular">{t.players}</td>
                  <td className="px-3 py-2 text-right tabular">{t.upcoming}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{t.next ? `${t.next.title}, ${when(t.next.startAt)}` : <span className="text-muted">none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-5">
        <h3 className="text-lg font-bold">Attendance and money</h3>
        <p className="text-sm text-muted">This season</p>
      </div>
      <ul className="grid grid-cols-3 gap-2" aria-label="Headline numbers">
        {[
          [s.attendance, "attendance"],
          [pct, "dues collected"],
          [s.answeredEarly, "answer before the day"],
        ].map(([n, l]) => (
          <li key={String(l)} className="rounded-lg bg-team-soft px-3 py-2.5">
            <p className="font-display text-3xl leading-none font-bold text-team-ink tabular">{n == null ? "–" : `${n}%`}</p>
            <p className="text-xs text-muted">{l}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="trend-h" className="grid gap-2">
        <h3 id="trend-h" className="font-semibold">
          Attendance, last 8 weeks
        </h3>
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
          <div aria-hidden className="flex h-36 flex-col justify-between text-right text-[11px] text-muted tabular">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div className="relative h-36 border-b border-border">
            <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <ol className="relative grid h-full grid-cols-8 items-end gap-1.5" aria-label="Attendance by week">
              {s.weeks.map((w) => (
                <li key={w.weekOf} className="group relative flex h-full items-end justify-center" tabIndex={0} aria-label={`Week of ${short(w.weekOf)}: ${w.rate == null ? "no attendance taken" : `${w.rate}%`}`}>
                  {w.rate != null ? (
                    <span className="block w-full max-w-7 rounded-t-[4px] bg-team" style={{ height: `${Math.max(2, w.rate)}%` }} />
                  ) : (
                    <span className="block h-0.5 w-full max-w-7 bg-border" />
                  )}
                  <span role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-fg px-2 py-1 text-xs whitespace-nowrap text-bg group-hover:block group-focus:block">
                    {short(w.weekOf)}: {w.rate == null ? "no attendance" : `${w.rate}%`} · {w.events} events
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div aria-hidden className="ml-[2.75rem] grid grid-cols-8 gap-1.5 text-center text-[11px] text-muted">
          {s.weeks.map((w) => (
            <span key={w.weekOf} className="truncate">
              {short(w.weekOf).replace(/^\w+ /, "")}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="team-h" className="grid gap-2">
        <h3 id="team-h" className="font-semibold">
          Attendance by team
        </h3>
        <ul className="grid gap-2">
          {s.byTeam.map((t) => (
            <li key={t.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm" title={`${t.name}: ${t.rate == null ? "no attendance yet" : `${t.rate}%`}, ${t.players} players`}>
              <span className="truncate">{t.name.replace(s.club.name.replace(/ FC$/, ""), "").trim() || t.name}</span>
              <span className="h-2.5 overflow-hidden rounded-pill bg-sunken">
                <span className="block h-full rounded-pill bg-team" style={{ width: `${t.rate ?? 0}%` }} />
              </span>
              <span className="text-right font-semibold tabular">{t.rate == null ? "–" : `${t.rate}%`}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <section className="rounded-lg border border-border p-3.5">
          <h3 className="font-semibold">
            {money(s.dues.collected)} of {money(s.dues.total)}
          </h3>
          <p className="text-sm text-muted">dues collected · {s.dues.owing} players still owe</p>
        </section>
        <section className="rounded-lg border border-border p-3.5">
          <h3 className="font-semibold">{s.carpool.seats} carpool seats</h3>
          <p className="text-sm text-muted">shared on {s.carpool.trips} {s.carpool.trips === 1 ? "trip" : "trips"}</p>
        </section>
      </div>

      <details className="rounded-lg border border-border p-3.5">
        <summary className="cursor-pointer text-sm font-semibold">See the numbers as a table</summary>
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Attendance by week</caption>
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-semibold">Week of</th>
              <th className="py-1 font-semibold">Events</th>
              <th className="py-1 text-right font-semibold">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {s.weeks.map((w) => (
              <tr key={w.weekOf} className="border-t border-border">
                <td className="py-1">{short(w.weekOf)}</td>
                <td className="py-1 tabular">{w.events}</td>
                <td className="py-1 text-right tabular">{w.rate == null ? "–" : `${w.rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
