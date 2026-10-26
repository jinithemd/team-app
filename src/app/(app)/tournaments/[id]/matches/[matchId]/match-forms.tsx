"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Minus, Plus, X } from "lucide-react";
import { addEventAction, removeEventAction, saveResultAction, setMotmAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";

function Stepper({ name, label, value, onChange }: { name: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="grid justify-items-center gap-1.5">
      <span className="max-w-full truncate text-center text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={`One less for ${label}`} onClick={() => onChange(Math.max(0, (value ?? 0) - 1))} className="grid size-11 place-items-center rounded-md border border-border-input">
          <Minus aria-hidden className="size-4" />
        </button>
        <input
          name={name}
          aria-label={`${label} score`}
          inputMode="numeric"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 0)))}
          className="h-14 w-16 rounded-md border border-border-input bg-bg text-center font-display text-3xl font-bold tabular"
        />
        <button type="button" aria-label={`One more for ${label}`} onClick={() => onChange((value ?? 0) + 1)} className="grid size-11 place-items-center rounded-md border border-border-input">
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ResultForm({
  id,
  matchId,
  knockout,
  ready,
  home,
  away,
  initial,
}: {
  id: string;
  matchId: string;
  knockout: boolean;
  ready: boolean;
  home: string;
  away: string;
  initial: { status: string; homeScore: number | null; awayScore: number | null; homePens: number | null; awayPens: number | null; kickoffAt: string | null; pitch: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResultAction.bind(null, id, matchId), null);
  const fe = state?.fieldErrors ?? {};
  const [hs, setHs] = useState(initial.homeScore);
  const [as, setAs] = useState(initial.awayScore);
  const [hp, setHp] = useState(initial.homePens);
  const [ap, setAp] = useState(initial.awayPens);
  const [status, setStatus] = useState(initial.status);
  // The time is typed in the phone's own time zone and sent as an exact instant.
  const [local, setLocal] = useState("");
  useEffect(() => setLocal(toLocalInput(initial.kickoffAt)), [initial.kickoffAt]);
  const iso = local ? new Date(local).toISOString() : "";
  const level = hs != null && as != null && hs === as;

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4" noValidate>
      <h2 className="text-lg font-semibold">Result</h2>
      {!ready && <p className="text-sm text-muted">Scores open once both teams are known.</p>}
      {ready && (
        <div className="grid grid-cols-2 gap-3">
          <Stepper name="homeScore" label={home} value={hs} onChange={(v) => { setHs(v); if (as == null) setAs(0); if (status === "scheduled") setStatus("live"); }} />
          <Stepper name="awayScore" label={away} value={as} onChange={(v) => { setAs(v); if (hs == null) setHs(0); if (status === "scheduled") setStatus("live"); }} />
        </div>
      )}
      {fe.homeScore && <p className="text-sm text-danger">{fe.homeScore}</p>}
      {ready && knockout && level && (
        <fieldset className="grid gap-2 rounded-md bg-surface p-3">
          <legend className="text-sm font-semibold">Penalty shoot-out</legend>
          <p className="text-xs text-muted">Knockout games can&apos;t end level.</p>
          <div className="grid grid-cols-2 gap-3">
            <Stepper name="homePens" label={home} value={hp} onChange={(v) => { setHp(v); if (ap == null) setAp(0); }} />
            <Stepper name="awayPens" label={away} value={ap} onChange={(v) => { setAp(v); if (hp == null) setHp(0); }} />
          </div>
          {fe.homePens && <p className="text-sm text-danger">{fe.homePens}</p>}
        </fieldset>
      )}
      <Field id="status" label="Status">
        <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="scheduled">Not started</option>
          <option value="live">Live</option>
          <option value="finished">Full time</option>
          <option value="postponed">Postponed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="kickoff" label="Kick-off" error={fe.kickoffAt}>
          <Input id="kickoff" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} error={fe.kickoffAt} />
        </Field>
        <Field id="pitch" label="Field" hint="Optional">
          <Input id="pitch" name="pitch" maxLength={60} defaultValue={initial.pitch} placeholder="Field 2" />
        </Field>
      </div>
      <input type="hidden" name="kickoffAt" value={iso} />
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && <p role="status" className="text-sm font-semibold text-success">{state.message}</p>}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function EventForm({ id, matchId, teams }: { id: string; matchId: string; teams: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addEventAction.bind(null, id, matchId), null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (state?.ok) setN((x) => x + 1);
  }, [state]);
  return (
    <form key={n} action={action} className="grid gap-3 rounded-md border border-border p-3" noValidate>
      <h3 className="text-sm font-semibold">Add a goal or card</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field id="ev-team" label="Team">
          <select id="ev-team" name="entryId" className={inputClass}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ev-kind" label="What">
          <select id="ev-kind" name="kind" className={inputClass}>
            <option value="goal">Goal</option>
            <option value="penalty_goal">Penalty goal</option>
            <option value="own_goal">Own goal</option>
            <option value="yellow">Yellow card</option>
            <option value="red">Red card</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
        <Field id="ev-min" label="Minute">
          <Input id="ev-min" name="minute" inputMode="numeric" maxLength={3} />
        </Field>
        <Field id="ev-player" label="Player" hint="Optional">
          <Input id="ev-player" name="player" maxLength={60} />
        </Field>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("secondary", "md", "justify-self-start")} disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
      <p className="text-xs text-muted">Goals listed here don&apos;t change the score: set the score above.</p>
    </form>
  );
}

export function RemoveEvent({ id, eventId }: { id: string; eventId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label="Remove" disabled={pending} onClick={() => start(async () => void (await removeEventAction(id, eventId)))} className="grid size-8 place-items-center rounded-md text-muted hover:text-danger">
      <X aria-hidden className="size-4" />
    </button>
  );
}

/** Officials pick the player of the match (optional) from either team's roster. */
export function MotmPicker({
  id,
  matchId,
  current,
  teams,
}: {
  id: string;
  matchId: string;
  current: string | null;
  teams: { entryId: string; team: string; players: { id: string; name: string; jersey: number | null }[] }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(setMotmAction.bind(null, id, matchId), null);
  const [value, setValue] = useState(current ?? "");
  const any = teams.some((t) => t.players.length);
  if (!any) return <p className="text-sm text-muted">Pick a player of the match once the teams have added their rosters.</p>;
  return (
    <form action={action} className="grid gap-2">
      <label htmlFor="motm" className="text-sm font-semibold">
        Choose the player of the match (optional)
      </label>
      <div className="flex gap-2">
        <select id="motm" name="motm" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} min-w-0 flex-1`}>
          <option value="">No one</option>
          {teams.map((t) => (
            <optgroup key={t.entryId} label={t.team}>
              {t.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey != null ? `#${p.jersey} ` : ""}
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className={buttonClass("primary", "md", "shrink-0")} disabled={pending || value === (current ?? "")} aria-busy={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state && (state.error || state.message) && (
        <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}
