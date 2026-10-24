import Link from "next/link";
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

export function TypeTag({ e }: { e: Pick<TeamEvent, "type" | "homeAway"> }) {
  const label = e.type === "game" ? (e.homeAway === "away" ? "Away" : e.homeAway === "neutral" ? "Neutral" : "Home") : null;
  if (!label) return null;
  return <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-muted uppercase">{label}</span>;
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

export function TeamDot({ name }: { name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
      <span aria-hidden className="size-2.5 shrink-0 rounded-pill bg-team ring-1 ring-border" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function EventCard({ e, showTeam = false }: { e: EventWithMine; showTeam?: boolean }) {
  const d = formatDateBlock(e.startAt, e.tz);
  const title = eventTitle(e);
  const cancelled = e.status === "cancelled";
  const today = isToday(e.startAt, e.tz);
  const past = Date.parse(e.endAt) < Date.now();
  const mineLabel = e.mine ? (e.mine.response ? RSVP_LABEL[e.mine.response] : "no answer yet") : "";
  return (
    <Link
      href={`/t/${e.teamId}/e/${e.id}`}
      data-team={showTeam ? e.teamId : undefined}
      aria-label={`${title}, ${d.dow} ${d.month} ${d.day}, ${formatTimeRange(e.startAt, e.endAt, e.tz)}${cancelled ? ", cancelled" : ""}${mineLabel ? ", " + mineLabel : ""}`}
      className={`grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-lg border p-3.5 shadow-card transition-colors hover:border-border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
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
          <TypeTag e={e} />
          <StatusBadge status={e.status} />
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
            {showTeam && <TeamDot name={e.team.name} />}
            {!cancelled && e.mine && <RsvpChip response={e.mine.response} />}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Week-grouped list: the default schedule view. */
export function ScheduleList({ events, showTeam = false }: { events: EventWithMine[]; showTeam?: boolean }) {
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
            <EventCard key={e.id} e={e} showTeam={showTeam} />
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
