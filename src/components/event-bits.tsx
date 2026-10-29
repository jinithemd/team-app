import Link from "next/link";
import { TeamCrest } from "@/components/ui";
import { Check, Clock, HelpCircle, MapPin, X } from "lucide-react";
import type { EventWithMine, RsvpResponse, TeamEvent } from "@/lib/data/types";
import { formatDateBlock, formatTimeRange, isToday, weekLabel } from "@/lib/time";
import { eventTitle } from "@/lib/event-title";

export const RSVP_LABEL: Record<RsvpResponse, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Can't make it",
};

export function StatusBadge({ status }: { status: TeamEvent["status"] | "live" | "final" }) {
  const map = {
    cancelled: ["bg-danger-soft text-danger", "Cancelled"],
    postponed: ["bg-warning-soft text-warning", "Postponed"],
    live: ["bg-live text-on-live", "Live"],
    final: ["bg-sunken text-fg", "Final"],
    active: ["", ""],
  } as const;
  const [cls, label] = map[status];
  if (!label) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold tracking-[.06em] uppercase ${cls}`}>
      {status === "live" && <span aria-hidden className="live-dot size-1.5 rounded-pill bg-current" />}
      {label}
    </span>
  );
}

/*
 * Every event has a colour by kind, so a list is easy to scan: training, matches, league
 * matches and tournaments (the tournament itself and its games). Socials and others stay neutral.
 */
export type EventKind = "training" | "match" | "league" | "tournament" | "session";
type KindSource = Pick<TeamEvent, "type" | "competition"> & { tournamentId?: string | null; sessionId?: string | null };
export function eventKind(e: KindSource): EventKind | null {
  if (e.sessionId) return "session";
  if (e.tournamentId || e.type === "tournament") return "tournament";
  if (e.type === "match") return e.competition === "league" ? "league" : "match";
  if (e.type === "training") return "training";
  return null;
}
export const KIND_LABEL: Record<EventKind, string> = { training: "Training", match: "Match", league: "League", tournament: "Tournament", session: "Drop-in" };
// Whole class names, so Tailwind sees them.
export const KIND_STRIPE: Record<EventKind, string> = { training: "border-l-ev-training", match: "border-l-ev-match", league: "border-l-ev-league", tournament: "border-l-ev-tournament", session: "border-l-ev-session" };
export const KIND_CHIP: Record<EventKind, string> = {
  training: "bg-ev-training-soft text-ev-training",
  match: "bg-ev-match-soft text-ev-match",
  league: "bg-ev-league-soft text-ev-league",
  tournament: "bg-ev-tournament-soft text-ev-tournament",
  session: "bg-ev-session-soft text-ev-session",
};
export const KIND_DOT: Record<EventKind, string> = { training: "bg-ev-training", match: "bg-ev-match", league: "bg-ev-league", tournament: "bg-ev-tournament", session: "bg-ev-session" };

export function TypeTag({ e, title }: { e: KindSource & Pick<TeamEvent, "homeAway">; title?: string }) {
  const k = eventKind(e);
  // No "Training" chip on an event already called Training: the stripe shows the colour.
  const kind = k && title?.trim().toLowerCase() === KIND_LABEL[k].toLowerCase() ? null : k;
  const labels: string[] = [];
  if (e.type === "match") labels.push(e.homeAway === "away" ? "Away" : e.homeAway === "neutral" ? "Neutral" : "Home");
  if (e.competition && e.competition !== "league" && kind !== "tournament") labels.push(e.competition === "cup" ? "Cup" : "Friendly");
  if (e.type === "social") labels.push("Social");
  if (!labels.length && !kind) return null;
  return (
    <>
      {kind && (
        <span className={`rounded-pill px-2 py-0.5 text-[11px] font-bold tracking-[.06em] uppercase ${KIND_CHIP[kind]}`}>{KIND_LABEL[kind]}</span>
      )}
      {labels.map((l) => (
        <span key={l} className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-muted uppercase">
          {l}
        </span>
      ))}
    </>
  );
}

export function ScoreBadge({ score }: { score: { us: number; them: number; status: string } | null }) {
  if (!score) return null;
  const live = score.status === "live";
  const result = score.us > score.them ? "W" : score.us < score.them ? "L" : "D";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-bold tabular ${
        live ? "bg-live text-on-live" : result === "W" ? "bg-success-soft text-success" : result === "L" ? "bg-danger-soft text-danger" : "bg-sunken text-fg"
      }`}
    >
      {live ? <span aria-hidden className="live-dot size-1.5 rounded-pill bg-current" /> : <span aria-hidden>{result}</span>}
      <span>
        {score.us}–{score.them}
      </span>
      <span className="sr-only">{live ? "live score" : result === "W" ? "win" : result === "L" ? "loss" : "draw"}</span>
    </span>
  );
}

export function RsvpChip({ response, name }: { response: RsvpResponse | null; name?: string }) {
  const styles = {
    going: ["bg-success-soft text-success", <Check key="i" aria-hidden />],
    maybe: ["bg-warning-soft text-warning", <HelpCircle key="i" aria-hidden />],
    not_going: ["bg-danger-soft text-danger", <X key="i" aria-hidden />],
  } as const;
  if (!response)
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
        {name ? `${name}: ` : ""}No answer yet
      </span>
    );
  const [cls, icon] = styles[response];
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold [&_svg]:size-3.5 ${cls}`}>
      {icon}
      {name ? `${name}: ` : ""}
      {RSVP_LABEL[response]}
    </span>
  );
}

export function UnavailableChip({ kind }: { kind: "injured" | "away" | "other" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
      {kind === "injured" ? "You're injured" : kind === "away" ? "You're away" : "You're unavailable"}
    </span>
  );
}

export function TeamDot({ name, teamId, crestUrl }: { name: string; teamId?: string; crestUrl?: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
      {teamId ? <TeamCrest teamId={teamId} name={name} crestUrl={crestUrl} size={16} /> : <span aria-hidden className="size-2.5 shrink-0 rounded-pill bg-team ring-1 ring-border" />}
      <span className="truncate">{name}</span>
    </span>
  );
}

export type TournamentBadge = { name: string; logoUrl: string | null; bannerUrl: string | null };

export function EventCard({ e, showTeam = false, tournament }: { e: EventWithMine; showTeam?: boolean; tournament?: TournamentBadge }) {
  const badge = tournament?.logoUrl ?? tournament?.bannerUrl ?? null;
  const d = formatDateBlock(e.startAt, e.tz);
  const title = eventTitle(e);
  const cancelled = e.status === "cancelled";
  const today = isToday(e.startAt, e.tz);
  const past = Date.parse(e.endAt) < Date.now();
  const mineLabel = e.mine ? (e.mine.response ? RSVP_LABEL[e.mine.response] : e.mine.unavailable ? "you're marked unavailable" : "no answer yet") : "";
  const kind = eventKind(e);
  return (
    <Link
      href={`/t/${e.teamId}/e/${e.id}`}
      data-team={showTeam ? e.teamId : undefined}
      aria-label={`${title}${kind ? `, ${KIND_LABEL[kind]}` : ""}, ${d.dow} ${d.month} ${d.day}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}${cancelled ? ", cancelled" : ""}${mineLabel ? ", " + mineLabel : ""}`}
      className={`grid ${badge ? "grid-cols-[52px_minmax(0,1fr)_auto]" : "grid-cols-[52px_minmax(0,1fr)]"} gap-3 rounded-lg border border-l-4 p-3.5 shadow-card transition-colors ${kind ? KIND_STRIPE[kind] : ""} hover:border-border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        today && !cancelled ? "border-transparent bg-team-soft" : "border-border bg-bg"
      } ${past ? "opacity-75" : ""}`}
    >
      <div className="text-center" aria-hidden>
        <div className="eyebrow">{d.dow}</div>
        <div className="font-display text-2xl leading-none font-bold">{d.day}</div>
        <div className="mt-0.5 text-[11px] font-medium text-muted">{d.month}</div>
      </div>
      <div className="min-w-0" aria-hidden>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={`min-w-0 text-base leading-[22px] font-semibold break-words ${cancelled ? "text-muted line-through" : ""}`}>
            {title}
          </h3>
          <TypeTag e={e} title={title} />
          <StatusBadge status={e.status} />
          <ScoreBadge score={e.score} />
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted [&_svg]:size-3.5">
          {cancelled && e.statusReason ? (
            <span>{e.statusReason}</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden />
                {formatTimeRange(e.startAt, e.endAt, e.tz)}
              </span>
              {e.locationText && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin aria-hidden className="shrink-0" />
                  <span className="truncate">{e.locationText}</span>
                </span>
              )}
            </>
          )}
        </div>
        {(showTeam || (!cancelled && e.mine)) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {showTeam && <TeamDot name={e.team.name} teamId={e.team.id} crestUrl={e.team.crestUrl} />}
            {!cancelled && e.mine && (e.mine.unavailable && !e.mine.response ? <UnavailableChip kind={e.mine.unavailable} /> : !past && <RsvpChip response={e.mine.response} />)}
          </div>
        )}
      </div>
      {badge && (
        // The tournament's own logo (or its banner when there's no logo), big enough to recognise.
        <img src={badge} alt={`${tournament!.name} logo`} className="size-20 shrink-0 self-center rounded-lg border border-border bg-bg object-contain p-1" />
      )}
    </Link>
  );
}

/** Week-grouped list: the default schedule view. */
export function ScheduleList({ events, showTeam = false, tournaments = {} }: { events: EventWithMine[]; showTeam?: boolean; tournaments?: Record<string, TournamentBadge> }) {
  const groups: { label: string; items: EventWithMine[] }[] = [];
  for (const e of events) {
    const label = weekLabel(e.startAt, e.tz);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return (
    <div className="grid gap-5">
      {groups.map((gr) => (
        <section key={gr.label} aria-label={gr.label} className="grid gap-2.5">
          <h2 className="eyebrow">{gr.label}</h2>
          {gr.items.map((e) => (
            <EventCard key={e.id} e={e} showTeam={showTeam} tournament={e.tournamentId ? tournaments[e.tournamentId] : undefined} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function Counts({ counts }: { counts: { going: number; maybe: number; not_going: number; none: number } }) {
  const items = [
    ["going", "going", "bg-success-soft text-success"],
    ["maybe", "maybe", "bg-warning-soft text-warning"],
    ["not_going", "can't", "bg-danger-soft text-danger"],
    ["none", "no reply", "bg-sunken text-muted"],
  ] as const;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Answers so far">
      {items.map(([k, label, cls]) => (
        <li key={k} className={`rounded-pill px-3 py-1.5 text-sm font-semibold tabular ${cls}`}>
          {counts[k]} {label}
        </li>
      ))}
    </ul>
  );
}

/** What the colours mean, above a list or calendar. */
export function KindLegend() {
  return (
    <ul aria-label="Event colours" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`size-2.5 rounded-pill ${KIND_DOT[k]}`} />
          {KIND_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}
