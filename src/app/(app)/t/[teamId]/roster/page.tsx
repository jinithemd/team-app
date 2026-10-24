import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Pencil, UserPlus, Users } from "lucide-react";
import { getTeam, listRoster, listTeamUnavailable } from "@/lib/data";
import { Avatar, Banner, ButtonLink, EmptyState } from "@/components/ui";
import { HatBadges } from "@/components/hats";
import { ROLE_LABEL, TEAM_ROLES, hatLabels, type RosterRow } from "@/lib/data/types";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ invited?: string; created?: string; saved?: string }>;
}) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [team, roster, out] = await Promise.all([getTeam(teamId), listRoster(teamId), listTeamUnavailable(teamId)]);
  if (!team) return null;
  const players = roster.filter((r) => r.isPlayer);
  const others = roster.filter((r) => !r.isPlayer);
  const onlyMe = roster.length === 1 && team.me && roster[0].id === team.me.id;
  const roleCounts = TEAM_ROLES.map((r) => [r, roster.filter((m) => m.roles.includes(r)).length] as const).filter(([, n]) => n > 0);
  const today = new Date().toISOString().slice(0, 10);
  // One badge per person: who's out now, or soon (next three weeks).
  const outNow = new Map<string, (typeof out)[number]>();
  for (const o of out) if (!outNow.has(o.person.id)) outNow.set(o.person.id, o);
  const editHref = (r: RosterRow) =>
    r.userId ? `/t/${teamId}/p/${r.userId}` : team.canManagePermissions ? `/t/${teamId}/roster/${r.id}` : undefined;
  const outLabel = (r: RosterRow) => {
    const o = r.userId ? outNow.get(r.userId) : undefined;
    if (!o) return undefined;
    const f = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00Z"));
    const what = o.kind === "injured" ? "Injured" : o.kind === "away" ? "Away" : "Unavailable";
    return o.startsOn <= today ? `${what} until ${f(o.endsOn)}` : `${what} ${f(o.startsOn)} – ${f(o.endsOn)}`;
  };

  return (
    <div className="grid gap-5">
      {sp.created && <Banner>Your team is ready. Add your players so they get the schedule.</Banner>}
      {sp.saved && (
        <Banner>
          {{ member: "Roles saved.", inactive: "Marked inactive.", active: "Marked active.", removed: "Removed from the team." }[sp.saved] ?? "Saved your part on the team."}
        </Banner>
      )}
      {sp.invited && (
        <Banner>
          Invites sent to {sp.invited} {sp.invited === "1" ? "person" : "people"}. They&apos;ll show as pending until they join.{" "}
          <a href="/dev/outbox" className="font-semibold text-team-ink underline">
            See the emails
          </a>
        </Banner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tabular">
            {players.length} {players.length === 1 ? "player" : "players"}
          </h2>
          {roleCounts.length > 0 && (
            <p className="text-sm text-muted tabular">
              {roleCounts.map(([r, n]) => `${n} ${ROLE_LABEL[r].toLowerCase()}${n > 1 ? (r === "coach" ? "es" : "s") : ""}`).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {team.me && (
            <ButtonLink href={`/t/${teamId}/you`} variant="secondary" size="sm">
              <Pencil aria-hidden />
              Your part
            </ButtonLink>
          )}
          {team.isStaff && (
            <ButtonLink href={`/t/${teamId}/roster/add`} size="sm">
              <UserPlus aria-hidden />
              Add people
            </ButtonLink>
          )}
        </div>
      </div>

      {roster.length === 0 || onlyMe ? (
        <>
          {onlyMe && (
            <ul>
              <RosterItem r={roster[0]} showContacts={team.isStaff} isMe href={editHref(roster[0])} out={outLabel(roster[0])} />
            </ul>
          )}
          <EmptyState
            icon={<Users />}
            title="Nobody else on the roster yet"
            hint={team.isStaff ? "Add players with their own email. You can paste a whole list at once." : undefined}
            action={
              team.isStaff && (
                <ButtonLink href={`/t/${teamId}/roster/add`} size="sm">
                  <UserPlus aria-hidden />
                  Add players
                </ButtonLink>
              )
            }
          />
        </>
      ) : (
        <>
          <ul aria-label="Players">
            {players.map((r) => (
              <RosterItem key={r.id} r={r} showContacts={team.isStaff} isMe={r.id === team.me?.id} href={editHref(r)} out={outLabel(r)} />
            ))}
          </ul>
          {others.length > 0 && (
            <section aria-labelledby="others-h" className="grid gap-1">
              <h2 id="others-h" className="eyebrow">
                Running the team, not playing
              </h2>
              <ul>
                {others.map((r) => (
                  <RosterItem key={r.id} r={r} showContacts={team.isStaff} isMe={r.id === team.me?.id} href={editHref(r)} out={outLabel(r)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {team.isStaff && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          <span className="text-muted">Export:</span>
          <a href={`/t/${teamId}/export/players.csv`} className="text-team-ink">Players</a>
          <a href={`/t/${teamId}/export/attendance.csv`} className="text-team-ink">Attendance</a>
          <a href={`/t/${teamId}/export/events.csv`} className="text-team-ink">Schedule</a>
        </p>
      )}
      {team.canManagePermissions && (
        <p className="text-xs text-muted">
          Open anyone to change their roles. A team can have several managers, coaches or captains, and one person can hold several roles.{" "}
          <Link href={`/t/${teamId}/you`} className="font-semibold text-team-ink underline">
            Change yours
          </Link>
        </p>
      )}
    </div>
  );
}

function RosterItem({ r, showContacts, isMe, href, out }: { r: RosterRow; showContacts: boolean; isMe?: boolean; href?: string; out?: string }) {
  const name = `${r.person.firstName} ${r.person.lastName}`;
  const labels = hatLabels({ isPlayer: false, roles: r.roles, clubRole: r.clubRole, isCreator: false });
  return (
    <li className="border-b border-border last:border-0">
      <Row href={href} label={`Open ${name}`}>
      {r.isPlayer && (
        <span className="w-8 shrink-0 text-center font-display text-xl font-bold text-team-ink tabular" aria-label={r.jersey ? `Number ${r.jersey}` : "No number"}>
          {r.jersey ?? "–"}
        </span>
      )}
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">
          {name}
          {isMe && <span className="font-normal text-muted"> (you)</span>}
        </p>
        {r.position && <p className="text-sm break-words text-muted">{r.position}</p>}
        {(labels.length > 0 || out || r.status === "inactive") && (
          <div className="mt-1 flex flex-wrap gap-1">
            <HatBadges labels={labels} />
            {out && <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-[11px] font-bold tracking-[.04em] text-warning uppercase">{out}</span>}
            {r.status === "inactive" && <span className="rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.04em] text-muted uppercase">Inactive</span>}
          </div>
        )}
        {r.status === "invited" && showContacts && r.email && <p className="text-xs break-all text-muted">{r.email}</p>}
      </div>
      {r.status === "invited" && (
        <span className="shrink-0 rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-muted uppercase">Invite sent</span>
      )}
      {href && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
      </Row>
    </li>
  );
}

function Row({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  const cls = "flex items-center gap-3 py-3";
  return href ? (
    <Link href={href} title={label} className={`${cls} -mx-2 rounded-md px-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus`}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}
