// Time zone helpers. Events store UTC instants plus the IANA zone they happen in,
// and are always shown in that zone (labelled when it differs from the viewer's).

export const DEFAULT_TZ = "America/Toronto";

function partsIn(ts: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Milliseconds the zone is ahead of UTC at instant ts. */
function offsetAt(ts: number, tz: string): number {
  const p = partsIn(ts, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
}

/** "2026-11-01" + "18:00" in tz -> UTC ISO string. Correct across daylight saving changes. */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ts = guess - offsetAt(guess, tz);
  ts = guess - offsetAt(ts, tz); // second pass settles DST edges
  return new Date(ts).toISOString();
}

/** UTC ISO -> { date: "YYYY-MM-DD", time: "HH:MM" } in tz. */
export function utcToZoned(iso: string, tz: string) {
  const p = partsIn(Date.parse(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

export function formatDateBlock(iso: string, tz: string) {
  const d = new Date(iso);
  return {
    dow: new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-CA", { timeZone: tz, day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat("en-CA", { timeZone: tz, month: "short" }).format(d),
  };
}

export function formatTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(/\s?([ap])\.?m\.?/i, (_, x) => ` ${x.toLowerCase()}m`);
}

export function formatTimeRange(startIso: string, endIso: string, tz: string) {
  return `${formatTime(startIso, tz)} – ${formatTime(endIso, tz)}`;
}

export function formatLongDate(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(
    new Date(iso),
  );
}

export function zoneLabel(tz: string) {
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  return `${city} time`;
}

/** Monday-based week key in tz, for grouping the schedule list. */
function weekStart(iso: string, tz: string): number {
  const { date } = utcToZoned(iso, tz);
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  return t - dow * 86400000;
}

export function weekLabel(iso: string, tz: string, nowIso = new Date().toISOString()): string {
  const diff = Math.round((weekStart(iso, tz) - weekStart(nowIso, tz)) / (7 * 86400000));
  if (diff === 0) return "This week";
  if (diff === 1) return "Next week";
  if (diff === -1) return "Last week";
  const start = new Date(weekStart(iso, tz));
  const end = new Date(start.getTime() + 6 * 86400000);
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" });
  return `${f.format(start)} – ${f.format(end)}`;
}

export function isToday(iso: string, tz: string, nowIso = new Date().toISOString()) {
  return utcToZoned(iso, tz).date === utcToZoned(nowIso, tz).date;
}

export function viewerTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
