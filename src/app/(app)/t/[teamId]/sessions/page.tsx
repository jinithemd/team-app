import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Repeat, Ticket } from "lucide-react";
import { teamSessions, WEEKDAYS } from "@/lib/sessions/service";
import { SessionRow } from "@/components/session-bits";
import { SeriesControls, SkipWeek } from "@/components/session-controls";
import { Banner, EmptyState, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Sessions" };
export const dynamic = "force-dynamic";

const price = (c: number) => (c ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "Free");
const ampm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};
const day = (iso: string, tz: string, withTime = false) =>
  new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: tz });

export default async function SessionsTab({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ weekly?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const v = await teamSessions(teamId);
  if (!v) notFound();
  return (
    <div className="grid gap-6">
      {sp.weekly && <Banner>Weekly session set up. Each week posts itself and tells your players and supporters.</Banner>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Game sessions</h2>
          <p className="text-sm text-muted">Drop-in games for your players and anyone who follows {v.team.name}.</p>
        </div>
        {v.manage && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/t/${teamId}/sessions/new`} className={buttonClass("primary", "sm")}>
              <CalendarPlus aria-hidden />
              New session
            </Link>
            <Link href={`/t/${teamId}/sessions/new?weekly=1`} className={buttonClass("secondary", "sm")}>
              <Repeat aria-hidden />
              Weekly
            </Link>
          </div>
        )}
      </div>

      {v.manage && !v.team.isPublic && (
        <Banner tone="warning">
          Your team is private, so only your players can see sessions. Turn on &ldquo;Public team&rdquo; in Settings to open them to supporters.
        </Banner>
      )}

      <section aria-labelledby="up-h" className="grid gap-2">
        <h3 id="up-h" className="eyebrow">
          Coming up
        </h3>
        {v.sessions.length ? (
          <ul className="grid gap-2">
            {v.sessions.map((c) => (
              <SessionRow key={c.id} c={c} member staff={v.manage} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Ticket />} title="No sessions yet" hint={v.manage ? "Post a drop-in game, or set one up every week." : "When your team posts a drop-in game, it shows up here."} />
        )}
      </section>

      {v.manage && v.series.length > 0 && (
        <section aria-labelledby="weekly-h" className="grid gap-2">
          <h3 id="weekly-h" className="eyebrow">
            Every week
          </h3>
          <ul className="grid gap-3">
            {v.series.map((x) => (
              <li key={x.id} className="grid gap-2 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {x.title} {!x.active && <span className="text-sm font-normal text-warning">· paused</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {WEEKDAYS[x.weekday]}s {ampm(x.startTime)}–{ampm(x.endTime)}
                      {x.venueName ? ` · ${x.venueName}` : ""} · {price(x.priceCents)} · {x.capacity} spots{x.memberSpots ? ` (${x.memberSpots} for players)` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      Posts {x.postDaysBefore === 0 ? "the same day" : `${x.postDaysBefore} ${x.postDaysBefore === 1 ? "day" : "days"} before`} at {ampm(x.postTime)}
                    </p>
                  </div>
                  <SeriesControls seriesId={x.id} active={x.active} />
                </div>
                {x.active && (
                  <ul className="grid border-t border-border pt-1">
                    {x.next.map((o) => (
                      <li key={o.date} className="flex items-center justify-between gap-2 text-sm">
                        <span className={o.skipped ? "text-muted line-through" : ""}>
                          {day(o.startsAt, x.tz)}
                          <span className="text-xs text-muted"> · {o.skipped ? "skipped" : Date.parse(o.postAt) <= Date.now() ? "posted" : `posts ${day(o.postAt, x.tz, true)}`}</span>
                        </span>
                        <SkipWeek seriesId={x.id} date={o.date} skipped={o.skipped} label={day(o.startsAt, x.tz)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
