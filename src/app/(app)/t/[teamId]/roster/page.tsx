import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { getTeam, listRoster } from "@/lib/data";
import { Avatar, Banner, ButtonLink, EmptyState } from "@/components/ui";
import type { RosterRow } from "@/lib/data/types";

export const metadata: Metadata = { title: "Roster" };

const ROLE: Record<string, string> = { head_coach: "Head coach", assistant_coach: "Assistant coach", manager: "Team manager", other: "Staff" };

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string; invited?: string; created?: string }>;
}) {
  const { teamId } = await params;
  const sp = await searchParams;
  const [team, roster] = await Promise.all([getTeam(teamId), listRoster(teamId)]);
  if (!team) return null;
  const tab = sp.tab === "staff" ? "staff" : "players";
  const players = roster.filter((r) => r.kind === "player");
  const staff = roster.filter((r) => r.kind === "staff");
  const rows = tab === "players" ? players : staff;

  return (
    <div className="grid gap-5">
      {sp.created && <Banner>Your team is ready. Add your players so their families get the schedule.</Banner>}
      {sp.invited && (
        <Banner>
          Invites sent to {sp.invited} {sp.invited === "1" ? "person" : "people"}. They&apos;ll show as pending until they join.{" "}
          <a href="/dev/outbox" className="font-semibold text-team-ink underline">
            See the emails
          </a>
        </Banner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Roster section" className="inline-flex gap-1 rounded-md bg-sunken p-1">
          {(
            [
              ["players", `Players · ${players.length}`],
              ["staff", `Staff · ${staff.length}`],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              href={k === "players" ? `/t/${teamId}/roster` : `/t/${teamId}/roster?tab=staff`}
              aria-current={tab === k ? "true" : undefined}
              className={`inline-flex min-h-9 items-center rounded-sm px-3.5 text-sm font-semibold tabular ${tab === k ? "bg-team text-on-team" : "text-muted hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        {team.isStaff && (
          <ButtonLink href={`/t/${teamId}/roster/add${tab === "staff" ? "?kind=staff" : ""}`} size="sm">
            <UserPlus aria-hidden />
            {tab === "staff" ? "Add staff" : "Add players"}
          </ButtonLink>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={tab === "players" ? "Nobody's on the roster yet" : "No other staff yet"}
          hint={
            team.isStaff
              ? tab === "players"
                ? "Add players with a parent's email. You can paste a whole list at once."
                : "Add assistant coaches or a team manager and choose what they can do."
              : undefined
          }
          action={
            team.isStaff && (
              <ButtonLink href={`/t/${teamId}/roster/add${tab === "staff" ? "?kind=staff" : ""}`} size="sm">
                <UserPlus aria-hidden />
                {tab === "staff" ? "Add staff" : "Add players"}
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul>
          {rows.map((r) => (
            <RosterItem key={r.id} r={r} showContacts={team.isStaff} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RosterItem({ r, showContacts }: { r: RosterRow; showContacts: boolean }) {
  const name = `${r.person.firstName} ${r.person.lastName}`;
  const sub =
    r.kind === "staff"
      ? ROLE[r.staffRole ?? "other"]
      : [r.position, showContacts && r.guardians.length ? `Parent: ${r.guardians.map((g) => g.name).join(", ")}` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      {r.kind === "player" && (
        <span className="w-8 shrink-0 text-center font-display text-xl font-bold text-team-ink tabular" aria-label={r.jersey ? `Number ${r.jersey}` : "No number"}>
          {r.jersey ?? "–"}
        </span>
      )}
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{name}</p>
        {sub && <p className="text-sm break-words text-muted">{sub}</p>}
        {r.status === "invited" && showContacts && r.invitedEmail && <p className="text-xs break-all text-muted">{r.invitedEmail}</p>}
      </div>
      {r.status === "invited" && (
        <span className="shrink-0 rounded-pill bg-sunken px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-muted uppercase">Invite sent</span>
      )}
    </li>
  );
}
