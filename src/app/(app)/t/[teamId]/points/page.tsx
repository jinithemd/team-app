import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getLeaderboard, listRoster } from "@/lib/data";
import { EmptyState } from "@/components/ui";
import { POINTS_REASON_LABEL } from "@/lib/data/rules";
import { ManualPoints, RemovePoints } from "./manual-points";

export const metadata: Metadata = { title: "Points" };

export default async function PointsPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ season?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [lb, roster] = await Promise.all([getLeaderboard(teamId, sp.season), listRoster(teamId)]);
  if (!lb) return null;
  if (!lb.enabled)
    return <EmptyState icon={<Trophy />} title="Points are off for this team" hint={lb.staff ? "Turn them on in team settings to reward turning up." : undefined} />;
  if (!lb.visible) return <EmptyState icon={<Trophy />} title="The leaderboard is captains only" hint="Your captains can see points for this team." />;
  const r = lb.rules;
  const rules: [string, number][] = [
    ["Training attended", r.training],
    ["Match played", r.match],
    ["Away match bonus", r.away_bonus],
    ["Player of the match", r.potm],
    [`Late by ${r.late_after_minutes} min or more`, r.late_penalty],
  ];
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Leaderboard</h2>
          <p className="text-sm text-muted">{lb.season?.name ?? "All time"} · updated after each event</p>
        </div>
        <nav aria-label="Season" className="flex flex-wrap gap-2">
          {lb.seasons.slice(0, 3).map((s) => (
            <Link
              key={s.id}
              href={`/t/${teamId}/points?season=${s.id}`}
              aria-current={lb.season?.id === s.id ? "true" : undefined}
              className={`inline-flex min-h-9 items-center rounded-pill border px-3 text-sm font-semibold ${lb.season?.id === s.id ? "border-fg bg-fg text-bg" : "border-border-input"}`}
            >
              {s.name}
            </Link>
          ))}
          <Link href={`/t/${teamId}/seasons`} className="inline-flex min-h-9 items-center px-2 text-sm font-semibold text-team-ink">
            Seasons
          </Link>
        </nav>
      </div>

      {lb.rows.every((x) => x.points === 0) ? (
        <EmptyState icon={<Trophy />} title="No points yet this season" hint="Points appear once attendance is taken." />
      ) : (
        <ol aria-label="Leaderboard" className="grid">
          {lb.rows.map((x) => (
            <li key={x.userId} className={x.me ? "-mx-3 rounded-md bg-team-soft px-3" : ""}>
              <Link href={`/t/${teamId}/p/${x.userId}`} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                <span className={`w-7 shrink-0 text-center font-display text-xl font-bold tabular ${x.place === 1 ? "text-warning" : "text-muted"}`} aria-label={`Place ${x.place}`}>
                  {x.place}
                </span>
                <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-team-soft font-display text-sm font-bold text-team-ink tabular">{x.jersey ?? "–"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">
                    {x.person.firstName} {x.person.lastName}
                    {x.me && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="block text-xs text-muted">
                    {[x.rate !== null ? `${x.rate}% attendance` : null, x.potm ? `${x.potm} POTM` : null, x.away ? `${x.away} away` : null, x.late ? `${x.late} late` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="font-display text-2xl font-bold tabular">{x.points}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="rules-h" className="grid gap-1 rounded-md bg-surface p-3.5 text-sm">
        <h3 id="rules-h" className="eyebrow">
          How points work
        </h3>
        {rules.map(([label, n]) => (
          <div key={label} className="flex justify-between">
            <span>{label}</span>
            <strong className={n < 0 ? "text-danger" : ""}>{n > 0 ? `+${n}` : n}</strong>
          </div>
        ))}
        <p className="mt-1 text-xs text-muted">Points come from attendance, so nobody can add their own. Captains can add a bonus with a reason.</p>
      </section>

      {lb.canAdd && (
        <section aria-labelledby="manual-h" className="grid gap-3 rounded-lg border border-border p-4">
          <h3 id="manual-h" className="font-semibold">
            Add or take away points
          </h3>
          <ManualPoints teamId={teamId} players={roster.filter((p) => p.isPlayer && p.status === "active" && p.userId).map((p) => ({ id: p.userId!, name: `${p.person.firstName} ${p.person.lastName}` }))} />
          {"manual" in lb && lb.manual && lb.manual.length > 0 && (
            <ul className="grid gap-1 border-t border-border pt-3 text-sm">
              {lb.manual.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>
                    <strong className="tabular">{m.points > 0 ? `+${m.points}` : m.points}</strong> {m.person.firstName} · {m.note ?? POINTS_REASON_LABEL.manual}
                  </span>
                  <RemovePoints teamId={teamId} pointsId={m.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
