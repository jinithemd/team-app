import type { Metadata } from "next";
import Link from "next/link";
import { listSeasons } from "@/lib/data";
import { Banner } from "@/components/ui";
import { CloseSeasonForm } from "./close-season";
import { seasonName } from "@/lib/data";

export const metadata: Metadata = { title: "Seasons" };

const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(d + "T12:00:00Z")) : "");

export default async function SeasonsPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ started?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const data = await listSeasons(teamId);
  if (!data) return null;
  const cur = data.current;
  const nextStart = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-bold">Seasons</h2>
      {sp.started && <Banner>New season started. The old one is in the history below, with its points and attendance locked.</Banner>}
      {cur && (
        <section aria-labelledby="cur-h" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="cur-h" className="eyebrow">
              Now · {cur.name}
            </h3>
            <span className="text-xs text-muted">
              {fmt(cur.startsOn)}
              {cur.endsOn ? ` – ${fmt(cur.endsOn)}` : ""}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [`${cur.record.w}-${cur.record.d}-${cur.record.l}`, "won-drawn-lost"],
              [cur.rate !== null ? `${cur.rate}%` : "–", "attendance"],
              [String(cur.events), "events"],
              [String(cur.remaining), "still to play"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-md bg-team-soft p-3">
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="block font-display text-2xl leading-none font-bold text-team-ink tabular">{n}</span>
                  <span className="text-xs text-muted">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
          {cur.top.length > 0 && (
            <p className="text-sm text-muted">
              Top points: {cur.top.map((t) => `${t.person.firstName} ${t.person.lastName} ${t.points}`).join(", ")}.
            </p>
          )}
        </section>
      )}

      {data.canManage && (
        <section aria-labelledby="close-h" className="grid gap-3 rounded-lg border border-border p-4">
          <h3 id="close-h" className="font-semibold">
            {cur ? `Close ${cur.name} and start the next` : "Start a season"}
          </h3>
          <p className="text-sm text-muted">Closing locks attendance, points and results. They stay in the history.</p>
          <CloseSeasonForm teamId={teamId} defaultName={seasonName(nextStart)} defaultStart={nextStart} activeCount={data.activeCount} series={data.series} />
        </section>
      )}

      {data.past.length > 0 && (
        <section aria-labelledby="past-h" className="grid gap-1">
          <h3 id="past-h" className="eyebrow">
            Past seasons
          </h3>
          <ul>
            {data.past.map((s) => (
              <li key={s.id}>
                <Link href={`/t/${teamId}/points?season=${s.id}`} className="flex justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0 hover:bg-surface">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-muted tabular">
                    {s.record.w + s.record.d + s.record.l ? `${s.record.w}-${s.record.d}-${s.record.l}` : `${s.events} events`}
                    {s.rate !== null ? ` · ${s.rate}%` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
