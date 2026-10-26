import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
import { getPlayerProfile, getTeam } from "@/lib/data";
import { Avatar } from "@/components/ui";
import { HatBadges } from "@/components/hats";
import { hatLabels } from "@/lib/data/types";
import { formatDateBlock } from "@/lib/time";
import { MemberStatusButtons } from "./status-buttons";

export const metadata: Metadata = { title: "Player" };

const STATUS = {
  present: ["Present", "text-success"],
  late: ["Late", "text-warning"],
  absent: ["Absent", "text-danger"],
  excused: ["Excused", "text-muted"],
} as const;
const fmt = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00Z"));

export default async function PlayerPage({ params }: { params: Promise<{ teamId: string; userId: string }> }) {
  const { teamId, userId } = await params;
  const [team, p] = await Promise.all([getTeam(teamId), getPlayerProfile(teamId, userId)]);
  if (!team || !p) notFound();
  const name = `${p.person.firstName} ${p.person.lastName}`;
  const labels = hatLabels({ isPlayer: p.row.isPlayer, roles: p.row.roles, clubRole: null, isCreator: false }, p.row.jersey);
  const stats = [
    p.stats.rate !== null ? [`${p.stats.rate}%`, "attendance"] : null,
    p.stats.points !== null ? [String(p.stats.points), p.stats.rank ? `points · ${ordinal(p.stats.rank)}` : "points"] : null,
    [String(p.stats.goals), p.stats.goals === 1 ? "goal" : "goals"],
    [String(p.stats.assists), p.stats.assists === 1 ? "assist" : "assists"],
    p.stats.potm ? [String(p.stats.potm), "player of the match"] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <div className="grid gap-6">
      <Link href={`/t/${teamId}/roster`} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Roster
      </Link>

      <section className="flex items-center gap-4">
        {p.row.jersey ? (
          <span aria-label={`Number ${p.row.jersey}`} className="grid size-16 shrink-0 place-items-center rounded-pill bg-team-2 font-display text-3xl font-bold text-on-team-2">
            {p.row.jersey}
          </span>
        ) : (
          <Avatar name={name} size={64} src={p.person.photo} />
        )}
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-none font-bold break-words uppercase">{name}</h2>
          {p.row.position && <p className="text-sm text-muted">{p.row.position}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <HatBadges labels={labels} />
            {p.row.status === "inactive" && <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold text-muted uppercase">Inactive</span>}
            {p.unavailable && (
              <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-[11px] font-bold tracking-[.04em] text-warning uppercase">
                {p.unavailable.kind === "injured" ? "Injured" : p.unavailable.kind === "away" ? "Away" : "Unavailable"} until {fmt(p.unavailable.until)}
              </span>
            )}
          </div>
        </div>
      </section>

      {p.row.isPlayer && (
        <section aria-labelledby="stats-h" className="grid gap-2">
          <h3 id="stats-h" className="eyebrow">
            {p.seasonName ?? "This season"}
          </h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map(([n, l]) => (
              <div key={l} className="rounded-md bg-surface p-3">
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="block font-display text-3xl leading-none font-bold tabular">{n}</span>
                  <span className="text-xs text-muted">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {p.recent.length > 0 && (
        <section aria-labelledby="recent-h" className="grid gap-1">
          <h3 id="recent-h" className="eyebrow">
            Recent
          </h3>
          <ul>
            {p.recent.map((r) => {
              const d = formatDateBlock(r.startAt, r.tz);
              const [label, cls] = STATUS[r.status];
              return (
                <li key={r.eventId}>
                  <Link href={`/t/${teamId}/e/${r.eventId}`} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0 hover:bg-surface">
                    <span className="min-w-0">
                      <span className="text-muted">
                        {d.dow} {d.month} {d.day} ·{" "}
                      </span>
                      {r.title}
                    </span>
                    <span className={`shrink-0 font-semibold ${cls}`}>
                      {r.geo && <MapPin aria-label="checked in at the venue" className="mr-1 inline size-3.5" />}
                      {label}
                      {r.status === "late" && r.minutesLate ? ` ${r.minutesLate} min` : ""}
                      {r.goals ? ` · ${r.goals} goal${r.goals > 1 ? "s" : ""}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {p.contact && (
        <section aria-labelledby="contact-h" className="grid gap-1 rounded-md bg-warning-soft p-3.5 text-sm">
          <h3 id="contact-h" className="text-xs font-bold tracking-[.06em] text-warning uppercase">
            {p.isMe ? "Only you and your captains see this" : "Only captains see this"}
          </h3>
          <p className="break-all">
            {p.contact.email}
            {p.contact.phone ? ` · ${p.contact.phone}` : ""}
          </p>
          {p.unavailable?.note && <p>{p.unavailable.note}</p>}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {p.isMe && (
          <Link href={`/t/${teamId}/you`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-surface px-4 text-sm font-semibold">
            <Pencil aria-hidden className="size-4" />
            Your part on the team
          </Link>
        )}
        {!p.isMe && team.canManagePermissions && (
          <Link href={`/t/${teamId}/roster/${p.row.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-surface px-4 text-sm font-semibold">
            <Pencil aria-hidden className="size-4" />
            Roles and permissions
          </Link>
        )}
        {!p.isMe && p.canEdit && <MemberStatusButtons teamId={teamId} memberId={p.row.id} status={p.row.status} />}
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
