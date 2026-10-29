import Link from "next/link";
import { Repeat } from "lucide-react";
import { teamSessions, WEEKDAYS } from "@/lib/sessions/service";
import { SeriesControls, SkipWeek } from "./session-controls";

// Staff, on the Schedule: weekly drop-ins (pause, skip a week) and drop-ins waiting to be posted.

const price = (c: number) => (c ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "Free");
const ampm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};
const day = (iso: string, tz: string, withTime = false) =>
  new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: tz });

export async function DropInManager({ teamId }: { teamId: string }) {
  const v = await teamSessions(teamId);
  if (!v?.manage) return null;
  const waiting = v.sessions.filter((c) => !c.posted && !c.cancelled);
  if (!v.series.length && !waiting.length) return null;
  return (
    <section aria-labelledby="dropins-h" className="grid gap-2">
      <h2 id="dropins-h" className="eyebrow flex items-center gap-1.5">
        <Repeat aria-hidden className="size-3.5" />
        Drop-ins you&apos;ve set up
      </h2>
      <ul className="grid gap-3">
        {waiting.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border border-l-4 border-l-ev-session p-3 text-sm">
            <span className="min-w-0">
              <Link href={`/s/${c.id}`} className="font-semibold text-fg hover:underline">
                {c.title}
              </Link>
              <span className="block text-xs text-muted">
                {day(c.startsAt, c.tz, true)} · posts {day(c.postAt, c.tz, true)}
              </span>
            </span>
          </li>
        ))}
        {v.series.map((x) => (
          <li key={x.id} className="grid gap-2 rounded-lg border border-border border-l-4 border-l-ev-session p-4">
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
  );
}
