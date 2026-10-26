import Link from "next/link";
import { Trophy } from "lucide-react";
import { TeamCrest } from "@/components/ui";
import type { MatchView, EntryView } from "@/lib/tournaments/service";
import type { StandingRow } from "@/lib/tournaments/engine";
import { STATUS_LABEL, type Tournament } from "@/lib/tournaments/types";

// Display pieces shared by the tournament dashboard and the public page (server-safe).

export const T_TZ = "America/Toronto";

export function fmtDates(t: Pick<Tournament, "startsOn" | "endsOn">) {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  const a = d(t.startsOn);
  const b = d(t.endsOn);
  const md = (x: Date) => x.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
  if (t.startsOn === t.endsOn) return `${md(a)}, ${a.getUTCFullYear()}`;
  return a.getUTCFullYear() === b.getUTCFullYear() ? `${md(a)} – ${md(b)}, ${b.getUTCFullYear()}` : `${md(a)}, ${a.getUTCFullYear()} – ${md(b)}, ${b.getUTCFullYear()}`;
}

export function fmtKickoff(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: T_TZ });
}

export const money = (cents: number, currency = "CAD") => (cents / 100).toLocaleString("en-CA", { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 });

export function TournamentLogo({ url, name, size = 48 }: { url: string | null; name: string; size?: 40 | 48 | 64 }) {
  const dims = { 40: "size-10 rounded-lg", 48: "size-12 rounded-lg", 64: "size-16 rounded-xl" }[size];
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center overflow-hidden ${dims} ${url ? "bg-bg ring-1 ring-border" : "bg-team-soft text-team-ink"}`}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <Trophy className="size-1/2" />}
    </span>
  );
}

export function StatusPill({ status }: { status: Tournament["status"] }) {
  const tone = {
    draft: "bg-sunken text-muted",
    registration: "bg-team-soft text-team-ink",
    in_progress: "bg-success-soft text-success",
    finished: "bg-sunken text-fg",
  }[status];
  return <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{STATUS_LABEL[status]}</span>;
}

function Side({ side, label, align, bold, muted }: { side: MatchView["home"]; label: string; align: "left" | "right"; bold?: boolean; muted?: boolean }) {
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {side ? (
        <TeamCrest teamId={side.teamId ?? "guest"} name={side.name} crestUrl={side.crestUrl} size={24} />
      ) : (
        <span aria-hidden className="size-6 shrink-0 rounded-md border border-dashed border-border-input" />
      )}
      <span className={`min-w-0 text-sm [overflow-wrap:break-word] hyphens-auto ${side ? "" : "italic text-muted"} ${bold ? "font-bold" : "font-medium"} ${muted ? "text-muted" : ""}`}>{label}</span>
    </span>
  );
}

export function scoreText(m: MatchView) {
  if (m.homeSource === "BYE" || m.awaySource === "BYE") return "Bye";
  if (m.homeScore == null || m.awayScore == null || m.status === "scheduled" || m.status === "postponed" || m.status === "cancelled") return "v";
  return `${m.homeScore}–${m.awayScore}`;
}

function statusText(m: MatchView) {
  if (m.homeSource === "BYE" || m.awaySource === "BYE") return "Goes straight through";
  if (m.status === "live") return "Live";
  if (m.status === "finished") return m.homePens != null && m.awayPens != null ? `Full time · Pens ${m.homePens}–${m.awayPens}` : "Full time";
  if (m.status === "postponed") return "Postponed";
  if (m.status === "cancelled") return "Cancelled";
  return fmtKickoff(m.kickoffAt) ?? "Time to be set";
}

export function FixtureRow({ m, href }: { m: MatchView; href?: string }) {
  const done = m.status === "finished";
  const body = (
    <>
      <span className="flex items-center gap-2">
        <Side side={m.home} label={m.homeLabel} align="left" bold={done && m.winnerId === m.homeId} muted={done && !!m.winnerId && m.winnerId !== m.homeId} />
        <span className={`min-w-12 shrink-0 rounded-md px-2 py-1 text-center font-display text-lg font-bold tabular ${m.status === "live" ? "bg-danger text-on-danger" : done ? "bg-fg text-bg" : "bg-sunken text-muted"}`}>
          {scoreText(m)}
        </span>
        <Side side={m.away} label={m.awayLabel} align="right" bold={done && m.winnerId === m.awayId} muted={done && !!m.winnerId && m.winnerId !== m.awayId} />
      </span>
      <span className="flex flex-wrap justify-center gap-x-2 text-xs text-muted">
        <span className={m.status === "live" ? "font-semibold text-danger" : ""}>{statusText(m)}</span>
        {m.pitch && <span>· {m.pitch}</span>}
      </span>
    </>
  );
  const label = `${m.homeLabel} ${m.homeScore ?? ""} ${m.awayLabel} ${m.awayScore ?? ""}, ${statusText(m)}`;
  return href ? (
    <Link href={href} aria-label={label} className="grid gap-1.5 rounded-lg border border-border p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-focus">
      {body}
    </Link>
  ) : (
    <div aria-label={label} className="grid gap-1.5 rounded-lg border border-border p-3">
      {body}
    </div>
  );
}

/** Fixtures grouped by round ("Round 1", "Group A · Round 2", "Semi-finals"). */
export function FixtureList({ matches, hrefFor, empty }: { matches: MatchView[]; hrefFor?: (m: MatchView) => string | undefined; empty: string }) {
  if (!matches.length) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">{empty}</p>;
  const groups: { name: string; items: MatchView[] }[] = [];
  for (const m of matches) {
    const name = m.roundName ?? `Round ${m.round}`;
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(m);
    else groups.push({ name, items: [m] });
  }
  return (
    <div className="grid gap-5">
      {groups.map((g) => (
        <section key={g.name} aria-label={g.name} className="grid gap-2">
          <h3 className="eyebrow">{g.name}</h3>
          <ul className="grid gap-2">
            {g.items.map((m) => (
              <li key={m.id}>
                <FixtureRow m={m} href={hrefFor?.(m)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function StandingsTable({ label, rows, advance, entries }: { label: string | null; rows: StandingRow[]; advance: number; entries: EntryView[] }) {
  const crest = (id: string) => entries.find((e) => e.id === id);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-sm tabular">
        <caption className="bg-surface px-3 py-2 text-left font-semibold">{label ? `Group ${label}` : "Table"}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th scope="col" className="w-7 py-2 pl-3 text-left font-semibold">#</th>
            <th scope="col" className="py-2 text-left font-semibold">Team</th>
            <th scope="col" className="hidden px-1.5 py-2 font-semibold min-[360px]:table-cell">P</th>
            <th scope="col" className="hidden px-1.5 py-2 font-semibold sm:table-cell">W</th>
            <th scope="col" className="hidden px-1.5 py-2 font-semibold sm:table-cell">D</th>
            <th scope="col" className="hidden px-1.5 py-2 font-semibold sm:table-cell">L</th>
            <th scope="col" className="hidden px-1.5 py-2 font-semibold sm:table-cell">GF</th>
            <th scope="col" className="hidden px-1.5 py-2 font-semibold sm:table-cell">GA</th>
            <th scope="col" className="px-1.5 py-2 font-semibold">GD</th>
            <th scope="col" className="py-2 pr-3 pl-1.5 font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-4 text-center text-muted">
                The table fills in as results come in.
              </td>
            </tr>
          )}
          {rows.map((r, i) => {
            const e = crest(r.entryId);
            const through = label != null && i < advance;
            return (
              <tr key={r.entryId} className={`border-b border-border last:border-0 ${through ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`}>
                <td className="py-2 pl-3 text-muted">{i + 1}</td>
                <td className="py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamCrest teamId={e?.teamId ?? "guest"} name={r.name} crestUrl={e?.crestUrl} size={20} />
                    <span className="min-w-0 break-words font-medium">{r.name}</span>
                  </span>
                </td>
                <td className="hidden px-1.5 py-2 text-center min-[360px]:table-cell">{r.played}</td>
                <td className="hidden px-1.5 py-2 text-center sm:table-cell">{r.won}</td>
                <td className="hidden px-1.5 py-2 text-center sm:table-cell">{r.drawn}</td>
                <td className="hidden px-1.5 py-2 text-center sm:table-cell">{r.lost}</td>
                <td className="hidden px-1.5 py-2 text-center sm:table-cell">{r.gf}</td>
                <td className="hidden px-1.5 py-2 text-center sm:table-cell">{r.ga}</td>
                <td className="px-1.5 py-2 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="py-2 pr-3 pl-1.5 text-center font-bold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {label != null && rows.length > 0 && <p className="border-t border-border px-3 py-1.5 text-xs text-muted">{advance === 1 ? "The winner goes" : `The top ${advance} go`} through to the knockout.</p>}
    </div>
  );
}

/** Knockout rounds side by side; scrolls sideways on phones (the one place that may). */
export function Bracket({ matches, hrefFor }: { matches: MatchView[]; hrefFor?: (m: MatchView) => string | undefined }) {
  const ko = matches.filter((m) => m.stage === "knockout");
  if (!ko.length) return null;
  const rounds = [...new Set(ko.map((m) => m.round))].sort((a, b) => a - b);
  // Just a final: no need for a sideways strip.
  const single = rounds.length === 1;
  return (
    <div className={single ? "" : "-mx-4 overflow-x-auto px-4 pb-2"} role="region" aria-label="Knockout bracket" tabIndex={single ? undefined : 0}>
      <div className={single ? "grid" : "flex min-w-max gap-3"}>
        {rounds.map((r) => {
          const items = ko.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
          return (
            <section key={r} aria-label={items[0].roundName ?? `Round ${r}`} className={`grid content-around gap-3 ${single ? "" : "w-72"}`}>
              <h3 className="eyebrow">{items[0].roundName}</h3>
              <ol className="grid h-full content-around gap-3">
                {items.map((m) => (
                  <li key={m.id}>
                    <FixtureRow m={m} href={hrefFor?.(m)} />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function ChampionBanner({ entry }: { entry: EntryView | undefined }) {
  if (!entry) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-fg p-4 text-bg">
      <Trophy aria-hidden className="size-8 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Champions</p>
        <p className="font-display text-2xl leading-tight font-bold break-words uppercase">{entry.name}</p>
      </div>
    </div>
  );
}
