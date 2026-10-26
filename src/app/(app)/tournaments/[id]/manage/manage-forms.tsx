"use client";

import { useActionState, useState, useTransition } from "react";
import { addAwardAction, addOfficialAction, deleteTournamentAction, removeAwardAction, removeOfficialAction, setStatusAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";
import { AWARD_PRESETS, type Official, type TournamentStatus } from "@/lib/tournaments/types";

export function StatusControls({ id, status, hasFixtures }: { id: string; status: TournamentStatus; hasFixtures: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (s: TournamentStatus) => start(async () => setMsg((await setStatusAction(id, s))?.error ?? null));
  const steps: { s: TournamentStatus; label: string; hint: string }[] = [
    { s: "draft", label: "Draft", hint: "Only organizers and officials see it." },
    { s: "registration", label: "Taking teams", hint: "Public page is live; teams can apply if you allow it." },
    { s: "in_progress", label: "Under way", hint: "Set automatically when you make fixtures." },
    { s: "finished", label: "Finished", hint: "Set automatically when there's a champion." },
  ];
  return (
    <section aria-labelledby="st-h" className="grid gap-2 rounded-lg border border-border p-4">
      <h2 id="st-h" className="text-lg font-semibold">
        Status
      </h2>
      <div role="radiogroup" aria-label="Status" className="grid gap-2 sm:grid-cols-2">
        {steps.map((x) => (
          <button
            key={x.s}
            type="button"
            role="radio"
            aria-checked={status === x.s}
            disabled={pending || (x.s === "in_progress" && !hasFixtures)}
            onClick={() => set(x.s)}
            className={`grid gap-0.5 rounded-md border p-3 text-left disabled:opacity-50 ${status === x.s ? "border-2 border-team bg-team-soft" : "border-border-input"}`}
          >
            <span className="text-sm font-semibold">{x.label}</span>
            <span className="text-xs text-muted">{x.hint}</span>
          </button>
        ))}
      </div>
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
    </section>
  );
}

export function Officials({ id, officials }: { id: string; officials: Official[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addOfficialAction.bind(null, id), null);
  const [removing, start] = useTransition();
  const fe = state?.fieldErrors ?? {};
  return (
    <section aria-labelledby="off-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div>
        <h2 id="off-h" className="text-lg font-semibold">
          Organizers and match officials
        </h2>
        <p className="text-sm text-muted">Your club&apos;s owner and admins are organizers already. Officials can enter scores and goals; organizers can change everything.</p>
      </div>
      {officials.length > 0 && (
        <ul className="grid gap-1.5">
          {officials.map((o) => (
            <li key={o.userId} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                <strong>{o.name}</strong> <span className="text-muted">· {o.role === "organizer" ? "Organizer" : "Match official"}</span>
              </span>
              <button type="button" disabled={removing} onClick={() => start(async () => void (await removeOfficialAction(id, o.userId)))} className="text-sm font-semibold text-muted hover:text-danger">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field id="officialEmail" label="Their email" error={fe.officialEmail} hint="They need a Clbx account.">
            <Input id="officialEmail" name="officialEmail" type="email" inputMode="email" error={fe.officialEmail} />
          </Field>
          <Field id="role" label="Can">
            <select id="role" name="role" className={inputClass}>
              <option value="official">Enter results</option>
              <option value="organizer">Run everything</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("secondary")} disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
          {state?.ok && <span role="status" className="text-sm text-success">{state.message}</span>}
          {state?.error && !Object.keys(fe).length && <span role="alert" className="text-sm text-danger">{state.error}</span>}
        </div>
      </form>
    </section>
  );
}

export function DeleteTournament({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="grid gap-2 rounded-lg border border-danger/40 p-4">
      <h2 className="font-semibold">Delete this tournament</h2>
      <p className="text-sm text-muted">Removes every fixture, result and team entry. It can&apos;t be undone.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (prompt(`Type the tournament's name to delete it:\n${name}`)?.trim() === name) start(async () => setMsg((await deleteTournamentAction(id))?.error ?? null));
        }}
        className={buttonClass("danger", "md", "justify-self-start")}
      >
        Delete tournament
      </button>
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
    </section>
  );
}

type AwardTeam = { entryId: string; team: string; players: { id: string; name: string; jersey: number | null }[] };

/** The host gives out awards: pick one (or name your own), the team, and the player. */
export function AwardsManager({
  id,
  teams,
  awards,
  topScorer,
}: {
  id: string;
  teams: AwardTeam[];
  awards: { id: string; title: string; winner: string; team: string | null }[];
  topScorer: { name: string; team: string; goals: number } | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAwardAction.bind(null, id), null);
  const [title, setTitle] = useState<string>(AWARD_PRESETS[0]);
  const [entryId, setEntryId] = useState(teams[0]?.entryId ?? "");
  const [rosterId, setRosterId] = useState("");
  const [removing, start] = useTransition();
  const fe = state?.fieldErrors ?? {};
  const players = teams.find((t) => t.entryId === entryId)?.players ?? [];
  const teamAward = title === "Fair play";
  return (
    <section aria-labelledby="aw-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div className="grid gap-1">
        <h2 id="aw-h" className="text-lg font-semibold">
          Awards
        </h2>
        <p className="text-sm text-muted">Best player, top scorer, best goalkeeper, or any award you like. Winners linked to their Clbx account get a badge on their profile.</p>
      </div>
      {awards.length > 0 && (
        <ul className="grid gap-1.5">
          {awards.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 break-words">
                <span className="font-semibold">{a.title}</span> · {a.winner}
                {a.team && <span className="text-muted"> ({a.team})</span>}
              </span>
              <button
                type="button"
                disabled={removing}
                onClick={() => start(async () => void (await removeAwardAction(id, a.id)))}
                className="shrink-0 text-sm font-semibold text-danger"
                aria-label={`Remove ${a.title}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {teams.length === 0 ? (
        <p className="text-sm text-muted">Awards open once teams are in.</p>
      ) : (
        <form action={action} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="aw-title" label="Award" error={fe.title}>
              <select id="aw-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass}>
                {AWARD_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="__other">Other…</option>
              </select>
            </Field>
            {title === "__other" && (
              <Field id="aw-custom" label="Award name" error={fe.title}>
                <Input id="aw-custom" name="custom" maxLength={60} placeholder="e.g. Golden boot" error={fe.title} />
              </Field>
            )}
            <Field id="aw-team" label="Team" error={fe.entryId}>
              <select
                id="aw-team"
                name="entryId"
                value={entryId}
                onChange={(e) => {
                  setEntryId(e.target.value);
                  setRosterId("");
                }}
                className={inputClass}
              >
                {teams.map((t) => (
                  <option key={t.entryId} value={t.entryId}>
                    {t.team}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="aw-player" label={teamAward ? "Player (optional for a team award)" : "Player"} error={fe.rosterId} hint={players.length ? undefined : "This team has no roster yet: the award goes to the team."}>
              <select id="aw-player" name="rosterId" value={rosterId} onChange={(e) => setRosterId(e.target.value)} className={inputClass} disabled={!players.length}>
                <option value="">{teamAward || !players.length ? "The whole team" : "Pick a player"}</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jersey != null ? `#${p.jersey} ` : ""}
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="aw-note" label="Note (optional)">
              <Input id="aw-note" name="note" maxLength={120} placeholder={title === "Top scorer" && topScorer ? `${topScorer.goals} goals` : "e.g. 7 goals"} />
            </Field>
          </div>
          {title === "Top scorer" && topScorer && (
            <p className="text-xs text-muted">
              From the match reports: {topScorer.name} ({topScorer.team}) leads with {topScorer.goals} {topScorer.goals === 1 ? "goal" : "goals"}.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button className={buttonClass("primary")} disabled={pending || (!teamAward && players.length > 0 && !rosterId)} aria-busy={pending}>
              {pending ? "Saving…" : "Give award"}
            </button>
            {state && (state.error || state.message) && (
              <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
                {state.error ?? state.message}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
