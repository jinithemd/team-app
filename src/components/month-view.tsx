import Link from "next/link";
import type { EventWithMine } from "@/lib/data/types";
import { DEFAULT_TZ, utcToZoned } from "@/lib/time";
import { EventCard, KIND_DOT, eventKind } from "./event-bits";

/**
 * Month grid with a dot per event; days with events link to the list below the grid.
 * Server-rendered for the month of the first upcoming event (or this month).
 */
export function MonthView({ events, teamId, month }: { events: EventWithMine[]; teamId: string; month?: string }) {
  const tz = events[0]?.tz ?? DEFAULT_TZ;
  const today = utcToZoned(new Date().toISOString(), tz).date;
  const ym = month ?? today.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const byDay = new Map<string, EventWithMine[]>();
  for (const e of events) {
    const d = utcToZoned(e.startAt, e.tz).date;
    if (!d.startsWith(ym)) continue;
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const monthName = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const listDays = [...byDay.keys()].sort();

  return (
    <div className="grid gap-5">
      <section aria-label={monthName} className="rounded-lg border border-border p-3">
        <h2 className="mb-2 px-1 font-semibold">{monthName}</h2>
        <div role="grid" aria-label={`${monthName} calendar`} className="grid grid-cols-7 gap-1 text-center">
          <div role="row" className="contents">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div role="columnheader" key={d} className="eyebrow py-1">
                {d}
              </div>
            ))}
          </div>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <div role="row" key={r} className="contents">
              {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                if (!d) return <div role="gridcell" key={i} />;
                const evs = byDay.get(d) ?? [];
                const isToday = d === today;
                const day = Number(d.slice(8));
                const label = `${new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"))}, ${evs.length ? `${evs.length} event${evs.length > 1 ? "s" : ""}` : "nothing scheduled"}`;
                const inner = (
                  <>
                    <span className={`tabular text-sm ${isToday ? "font-bold" : ""}`}>{day}</span>
                    <span aria-hidden className="flex h-1.5 justify-center gap-0.5">
                      {evs.slice(0, 3).map((e) => (
                        <span key={e.id} className={`size-1.5 rounded-pill ${e.status === "cancelled" ? "bg-border-input" : (() => { const k = eventKind(e); return k ? KIND_DOT[k] : "bg-team-ink"; })()}`} />
                      ))}
                    </span>
                  </>
                );
                const cls = `grid min-h-11 content-center justify-items-center gap-1 rounded-md ${isToday ? "bg-team-soft" : ""}`;
                return (
                  <div role="gridcell" key={d}>
                    {evs.length ? (
                      <Link href={`/t/${teamId}/schedule?view=month#d-${d}`} aria-label={label} className={`${cls} hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus`}>
                        {inner}
                      </Link>
                    ) : (
                      <span aria-label={label} className={cls}>
                        {inner}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      {listDays.map((d) => (
        <section key={d} id={`d-${d}`} className="grid scroll-mt-4 gap-2.5">
          <h2 className="eyebrow">
            {new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"))}
          </h2>
          {byDay.get(d)!.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </section>
      ))}
    </div>
  );
}
