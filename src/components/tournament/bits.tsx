import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Clock, MapPin, Star, Trophy } from "lucide-react";
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

function statusText(m: MatchView): string | null {
  if (m.homeSource === "BYE" || m.awaySource === "BYE") return "Goes straight through";
  if (m.status === "live") return "Live";
  if (m.status === "finished") return m.homePens != null && m.awayPens != null ? `Full time · Pens ${m.homePens}–${m.awayPens}` : "Full time";
  if (m.status === "postponed") return "Postponed";
  if (m.status === "cancelled") return "Cancelled";
  return null;
}

const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: T_TZ });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: T_TZ });
const isBye = (m: MatchView) => m.homeSource === "BYE" || m.awaySource === "BYE";

/** One match: when and where on top, then the teams and score. */
export function FixtureRow({ m, href, dayShown = false }: { m: MatchView; href?: string; dayShown?: boolean }) {
  const done = m.status === "finished";
  const status = statusText(m);
  const when = m.kickoffAt ? (dayShown ? timeOnly(m.kickoffAt) : fmtKickoff(m.kickoffAt)) : null;
  const body = (
    <>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`inline-flex items-center gap-1 font-semibold ${when ? "text-fg" : "text-muted"}`}>
          <Clock aria-hidden className="size-3.5" />
          {when ?? "Time to be set"}
        </span>
        {m.pitch && (
          <span className="inline-flex items-center gap-1 font-semibold text-fg">
            <MapPin aria-hidden className="size-3.5" />
            {m.pitch}
          </span>
        )}
        <span className="ml-auto text-muted">{m.roundName}</span>
      </span>
      <span className="flex items-center gap-2">
        <Side side={m.home} label={m.homeLabel} align="left" bold={done && m.winnerId === m.homeId} muted={done && !!m.winnerId && m.winnerId !== m.homeId} />
        <span className={`min-w-12 shrink-0 rounded-md px-2 py-1 text-center font-display text-lg font-bold tabular ${m.status === "live" ? "bg-danger text-on-danger" : done ? "bg-fg text-bg" : "bg-sunken text-muted"}`}>
          {scoreText(m)}
        </span>
        <Side side={m.away} label={m.awayLabel} align="right" bold={done && m.winnerId === m.awayId} muted={done && !!m.winnerId && m.winnerId !== m.awayId} />
      </span>
      {status && <span className={`text-center text-xs ${m.status === "live" ? "font-semibold text-danger" : "text-muted"}`}>{status}</span>}
      {m.motm && (
        <span className="flex items-center justify-center gap-1 text-xs">
          <Star aria-hidden className="size-3.5 text-ev-tournament" />
          <span className="text-muted">Player of the match:</span>
          <span className="font-semibold">{m.motm.name}</span>
        </span>
      )}
    </>
  );
  const label = [`${m.homeLabel} ${m.homeScore ?? ""} ${m.awayLabel} ${m.awayScore ?? ""}`, m.roundName, m.kickoffAt ? fmtKickoff(m.kickoffAt) : "Time to be set", m.pitch, status]
    .filter(Boolean)
    .join(", ");
  return href ? (
    <Link href={href} aria-label={label} className="grid gap-2 rounded-lg border border-border p-3 hover:border-border-input focus-visible:outline-2 focus-visible:outline-focus">
      {body}
    </Link>
  ) : (
    <div aria-label={label} className="grid gap-2 rounded-lg border border-border p-3">
      {body}
    </div>
  );
}

/** Kick-off order; matches without a time go last, in round order. */
function byTime(a: MatchView, b: MatchView) {
  if (a.kickoffAt && b.kickoffAt) return a.kickoffAt.localeCompare(b.kickoffAt) || (a.pitch ?? "").localeCompare(b.pitch ?? "");
  if (a.kickoffAt) return -1;
  if (b.kickoffAt) return 1;
  return a.round - b.round || (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") || a.slot - b.slot;
}

/** Matches in time order, under a heading for each day. */
function DayList({ matches, hrefFor }: { matches: MatchView[]; hrefFor?: (m: MatchView) => string | undefined }) {
  const days: { name: string; items: MatchView[] }[] = [];
  for (const m of [...matches].sort(byTime)) {
    const name = m.kickoffAt ? dayKey(m.kickoffAt) : "Time to be set";
    const d = days.find((x) => x.name === name);
    if (d) d.items.push(m);
    else days.push({ name, items: [m] });
  }
  return (
    <div className="grid gap-5">
      {days.map((d) => (
        <section key={d.name} aria-label={d.name} className="grid gap-2">
          <h3 className="eyebrow">{d.name}</h3>
          <ul className="grid gap-2">
            {d.items.map((m) => (
              <li key={m.id}>
                <FixtureRow m={m} href={hrefFor?.(m)} dayShown={!!m.kickoffAt} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stage({ title, note, open, children }: { title: string; note: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-lg border border-border [&[open]>summary]:border-b">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 border-border px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-muted">{note}</span>
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-3">{children}</div>
    </details>
  );
}

/**
 * Fixtures in kick-off order, by day, each showing its time and field. With groups and a
 * knockout: while groups are being played they're open and the knockout is folded away;
 * once every group game is done, the knockout is open and the group stage folds away.
 */
export function FixtureList({ matches, hrefFor, empty, byStage = true }: { matches: MatchView[]; hrefFor?: (m: MatchView) => string | undefined; empty: string; byStage?: boolean }) {
  if (!matches.length) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">{empty}</p>;
  if (!byStage) return <DayList matches={matches} hrefFor={hrefFor} />;
  const group = matches.filter((m) => m.stage === "group");
  const ko = matches.filter((m) => m.stage === "knockout");
  if (!group.length || !ko.length) return <DayList matches={matches} hrefFor={hrefFor} />;
  const played = group.filter((m) => m.status === "finished" || m.status === "cancelled").length;
  const groupsDone = played === group.length;
  const koPlayed = ko.filter((m) => !isBye(m) && m.status === "finished").length;
  const koGames = ko.filter((m) => !isBye(m)).length;
  const games = (n: number) => `${n} ${n === 1 ? "game" : "games"}`;
  const groupStage = (
    <Stage key="g" title="Group stage" note={groupsDone ? `All ${games(group.length)} played · tap to see them` : `${played} of ${games(group.length)} played`} open={!groupsDone}>
      <DayList matches={group} hrefFor={hrefFor} />
    </Stage>
  );
  const knockout = (
    <Stage key="k" title="Knockout" note={groupsDone ? `${koPlayed} of ${games(koGames)} played` : "Starts once the group stage is over · tap to see the draw"} open={groupsDone}>
      <DayList matches={ko} hrefFor={hrefFor} />
    </Stage>
  );
  return <div className="grid gap-3">{groupsDone ? [knockout, groupStage] : [groupStage, knockout]}</div>;
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

/** Accepted teams in seed order, with seeds, groups and keep-apart sets, for everyone to see. */
export function SeededTeams({ entries, groups, showPaid = false }: { entries: EntryView[]; groups: boolean; showPaid?: boolean }) {
  const list = [...entries].sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
  const seeded = list.some((e) => e.seed != null);
  const sets = [...new Set(list.map((e) => e.apartSet).filter((x): x is number => x != null))].sort((a, b) => a - b);
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">{seeded ? "In seed order, set by the host. Seed 1 is the top seed." : "The host hasn't set the seeding yet."}</p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {list.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            {seeded && (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold tabular-nums" aria-label={e.seed ? `Seed ${e.seed}` : "Not seeded"}>
                {e.seed ?? "–"}
              </span>
            )}
            <TeamCrest teamId={e.teamId ?? "guest"} name={e.name} crestUrl={e.crestUrl} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold break-words">{e.name}</span>
              {(e.hostClub || (groups && e.apartSet != null)) && (
                <span className="block text-xs text-muted">{[e.hostClub ? "Host club" : null, groups && e.apartSet != null ? `Kept apart · set ${e.apartSet}` : null].filter(Boolean).join(" · ")}</span>
              )}
            </span>
            <span className="grid shrink-0 justify-items-end gap-0.5 text-xs font-semibold">
              {e.groupLabel && <span className="text-muted">Group {e.groupLabel}</span>}
              {showPaid && <span className={e.paid ? "text-success" : "text-muted"}>{e.paid ? "Paid" : "Not paid"}</span>}
            </span>
          </li>
        ))}
      </ol>
      {groups && sets.length > 0 && (
        <div className="grid gap-1 rounded-md bg-surface p-3 text-sm">
          <p className="font-semibold">Kept apart in the group stage</p>
          {sets.map((s) => (
            <p key={s} className="text-muted">
              Set {s}: {list.filter((e) => e.apartSet === s).map((e) => e.name).join(", ")} won&apos;t be in the same group.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Who has paid the entry fee and who hasn't (fees are paid outside the app; the host ticks them off). */
export function FeeSummary({ entries, fee, payTo }: { entries: EntryView[]; fee: string; payTo?: string | null }) {
  const paid = entries.filter((e) => e.paid).sort((a, b) => a.name.localeCompare(b.name));
  const unpaid = entries.filter((e) => !e.paid).sort((a, b) => a.name.localeCompare(b.name));
  const col = (title: string, list: EntryView[], tone: string, mark: string) => (
    <div className="grid content-start gap-1.5">
      <h3 className={`text-sm font-semibold ${tone}`}>
        {title} ({list.length})
      </h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted">None</p>
      ) : (
        <ul className="grid gap-1.5">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${tone === "text-success" ? "bg-success text-on-success" : "bg-sunken text-muted"}`}>
                {mark}
              </span>
              <span className="min-w-0 break-words">{e.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const pct = entries.length ? Math.round((paid.length / entries.length) * 100) : 0;
  return (
    <section id="fees" aria-labelledby="fee-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div className="grid gap-1">
        <h2 id="fee-h" className="flex items-baseline justify-between gap-2 text-lg font-semibold">
          Entry fees
          <span className="text-sm font-normal text-muted">
            {paid.length} of {entries.length} paid
          </span>
        </h2>
        <p className="text-xs text-muted">
          {fee} per team, paid to the host outside the app{payTo ? ` (${payTo})` : ""}. The host marks each team once it&apos;s paid.
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Teams paid" aria-valuemin={0} aria-valuemax={entries.length} aria-valuenow={paid.length}>
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {col("Paid", paid, "text-success", "✓")}
        {col("Not paid", unpaid, "text-fg", "–")}
      </div>
    </section>
  );
}

/** The tournament's awards and the top scorers from the match reports. */
export function AwardsBoard({ awards, topScorers }: { awards: import("@/lib/tournaments/service").AwardView[]; topScorers: { name: string; team: string; goals: number }[] }) {
  if (!awards.length && !topScorers.length) return null;
  return (
    <div className="grid gap-4">
      {awards.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Awards">
          {awards.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border-2 border-ev-tournament bg-ev-tournament-soft p-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-ev-tournament text-bg">
                <Trophy className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold tracking-[.06em] text-ev-tournament uppercase">{a.title}</span>
                <span className="block font-semibold break-words">
                  {a.jersey != null ? `#${a.jersey} ` : ""}
                  {a.winner}
                </span>
                {(a.team || a.note) && <span className="block text-xs text-muted">{[a.team, a.note].filter(Boolean).join(" · ")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {topScorers.length > 0 && (
        <div className="grid gap-1.5">
          <h3 className="eyebrow">Top scorers</h3>
          <ol className="grid gap-1 text-sm">
            {topScorers.slice(0, 5).map((s, i) => (
              <li key={`${s.team}-${s.name}`} className="flex items-center gap-2">
                <span className="w-5 text-muted tabular">{i + 1}</span>
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-semibold">{s.name}</span> <span className="text-muted">· {s.team}</span>
                </span>
                <span className="font-bold tabular">{s.goals}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
