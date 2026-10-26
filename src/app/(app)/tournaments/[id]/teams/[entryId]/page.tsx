import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { getRoster } from "@/lib/tournaments/service";
import type { RosterPerson } from "@/lib/tournaments/types";
import { Banner, TeamCrest } from "@/components/ui";
import { fmtKickoff } from "@/components/tournament/bits";
import { AddPersonForm, CaptainPicker, PersonActions, PickFromTeam, SubmitRoster } from "./roster-forms";

// A team's tournament roster: players with numbers, a manager and a coach. The team fills it
// in and submits; after that only the host can change it, and each change is marked here.

function ChangeMark({ p }: { p: RosterPerson }) {
  if (!p.hostChange) return null;
  const when = p.hostChangedAt ? fmtKickoff(p.hostChangedAt) : null;
  const was =
    p.hostChange === "edited"
      ? [p.prevJersey != null && p.prevJersey !== p.jersey ? `#${p.prevJersey}` : null, p.prevName && p.prevName !== p.name ? p.prevName : null].filter(Boolean).join(" ")
      : "";
  const captain = p.hostChange === "edited" && p.prevCaptain != null && p.prevCaptain !== p.isCaptain ? (p.isCaptain ? "made captain" : "no longer captain") : "";
  const text = { added: "Added by host", edited: "Changed by host", removed: "Removed by host" }[p.hostChange];
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
      <span className="rounded bg-warning-soft px-1.5 py-0.5 font-semibold text-fg">{text}</span>
      {was && <span className="text-muted">was {was}</span>}
      {captain && <span className="text-muted">{captain}</span>}
      {when && <span className="text-muted">· {when}</span>}
    </span>
  );
}

export default async function RosterPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const v = await getRoster(id, entryId);
  if (!v) notFound();
  const { t, entry } = v;
  const staff = (role: "manager" | "coach") => v.people.filter((p) => p.role === role);
  const players = v.people.filter((p) => p.role === "player");
  const activePlayers = players.filter((p) => p.hostChange !== "removed");
  const rules = (t.rosterRules ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const submitted = !!entry.rosterSubmittedAt;
  const hostEditing = v.isHost && submitted;
  const limit = t.rosterMax ? ` of ${t.rosterMax}` : "";

  const row = (p: RosterPerson, label?: string) => {
    const gone = p.hostChange === "removed";
    return (
      <li key={p.id} className={`flex flex-wrap items-start gap-3 rounded-md border p-2.5 ${p.hostChange ? "border-warning" : "border-border"} ${gone ? "opacity-70" : ""}`}>
        {p.role === "player" ? (
          <span className={`grid size-9 shrink-0 place-items-center rounded-md bg-sunken font-display text-base font-bold tabular ${gone ? "line-through" : ""}`} aria-label={`Number ${p.jersey ?? p.prevJersey}`}>
            {p.jersey ?? p.prevJersey}
          </span>
        ) : (
          <span className="grid h-9 min-w-16 shrink-0 place-items-center rounded-md bg-sunken px-2 text-xs font-semibold">{label}</span>
        )}
        <span className="min-w-0 flex-1 py-1">
          <span className={`block font-semibold break-words ${gone ? "line-through" : ""}`}>
            {p.name}
            {p.isCaptain && (
              <span className="ml-1.5 inline-grid size-5 place-items-center rounded-full bg-team align-middle text-[11px] font-bold text-on-team" title="Captain" aria-label="Captain">
                C
              </span>
            )}
          </span>
          <ChangeMark p={p} />
        </span>
        {v.canEdit && !gone && <PersonActions id={t.id} entryId={entry.id} person={{ id: p.id, name: p.name, jersey: p.jersey, role: p.role }} warnMark={hostEditing} />}
      </li>
    );
  };

  return (
    <>
      <Link href={`/tournaments/${t.id}/teams`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-team-ink">
        <ArrowLeft aria-hidden className="size-4" />
        All teams
      </Link>

      <header className="flex items-center gap-3">
        <TeamCrest teamId={entry.teamId ?? "guest"} name={entry.name} crestUrl={entry.crestUrl} size={48} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold break-words">{entry.name} roster</h2>
          <p className="text-sm text-muted">
            {v.players}
            {limit} players
            {t.rosterMin ? ` · at least ${t.rosterMin}` : ""}
          </p>
        </div>
      </header>

      <div className="grid gap-2">
        {submitted ? (
          <Banner icon={<Lock />}>
            <span className="font-semibold">Submitted {fmtKickoff(entry.rosterSubmittedAt)}</span> · Only the host can change it now, and every change is marked.
          </Banner>
        ) : v.lockReason ? (
          <Banner tone="warning" icon={<Lock />}>
            {v.lockReason}
          </Banner>
        ) : (
          <Banner tone="warning">
            <span className="font-semibold">Not submitted yet.</span>{" "}
            {v.closesAt ? `Submit it before ${fmtKickoff(v.closesAt)}.` : "Submit it before your first game."} Once it&apos;s submitted you can&apos;t change it.
          </Banner>
        )}
        {v.hostChanges > 0 && (
          <Banner tone="warning" icon={<ShieldAlert />}>
            The host changed this roster after it was submitted ({v.hostChanges} {v.hostChanges === 1 ? "change" : "changes"}). Each one is marked below.
          </Banner>
        )}
        {hostEditing && <p className="text-xs text-muted">You&apos;re the host: you can still change this roster, but each change shows on it as changed by the host.</p>}
      </div>

      {rules.length > 0 && (
        <section aria-labelledby="crit-h" className="grid gap-1.5 rounded-lg border border-border p-4">
          <h3 id="crit-h" className="font-semibold">
            Player criteria
          </h3>
          <ul className="grid list-disc gap-1 pl-5 text-sm">
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="staff-h" className="grid gap-2">
        <h3 id="staff-h" className="text-lg font-semibold">
          Manager and coach
        </h3>
        <ul className="grid gap-2">
          {(["manager", "coach"] as const).flatMap((role) => staff(role).map((p) => row(p, role === "manager" ? "Manager" : "Coach")))}
        </ul>
        {v.canEdit &&
          (["manager", "coach"] as const)
            .filter((role) => !staff(role).some((p) => p.hostChange !== "removed"))
            .map((role) => <AddPersonForm key={role} id={t.id} entryId={entry.id} role={role} />)}
        {!v.canEdit && !v.people.some((p) => p.role !== "player") && <p className="text-sm text-muted">None listed.</p>}
      </section>

      <section aria-labelledby="players-h" className="grid gap-2">
        <h3 id="players-h" className="flex items-baseline justify-between gap-2 text-lg font-semibold">
          Players
          <span className="text-sm font-normal text-muted">
            {v.players}
            {limit}
          </span>
        </h3>
        {players.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">No players yet.</p>
        ) : (
          <ul className="grid gap-2">{players.map((p) => row(p))}</ul>
        )}
        {v.canEdit && activePlayers.length > 0 ? (
          <CaptainPicker
            id={t.id}
            entryId={entry.id}
            players={activePlayers.map((p) => ({ id: p.id, label: `#${p.jersey} ${p.name}` }))}
            current={activePlayers.find((p) => p.isCaptain)?.id ?? null}
            warnMark={hostEditing}
          />
        ) : (
          activePlayers.length > 0 && (
            <p className="text-sm">
              <span className="text-muted">Captain: </span>
              <span className="font-semibold">{activePlayers.find((p) => p.isCaptain)?.name ?? "not chosen"}</span>
            </p>
          )
        )}
        {v.canEdit && (t.rosterMax == null || v.players < t.rosterMax) && (
          <>
            {v.pickable.length > 0 && <PickFromTeam id={t.id} entryId={entry.id} players={v.pickable} room={t.rosterMax != null ? t.rosterMax - v.players : null} />}
            <AddPersonForm id={t.id} entryId={entry.id} role="player" />
          </>
        )}
        {v.canEdit && t.rosterMax != null && v.players >= t.rosterMax && <p className="text-sm text-muted">The roster is full ({t.rosterMax} players).</p>}
      </section>

      {!submitted && v.canEdit && (
        <SubmitRoster id={t.id} entryId={entry.id} criteria={rules.length > 0} players={v.players} min={Math.max(1, t.rosterMin ?? 1)} forTeam={v.isHost && !v.isTeamStaff} />
      )}
    </>
  );
}
