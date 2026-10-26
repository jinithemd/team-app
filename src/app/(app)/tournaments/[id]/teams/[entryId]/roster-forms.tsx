"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { addFromTeamAction, addRosterPersonAction, editRosterPersonAction, removeRosterPersonAction, setCaptainAction, submitRosterAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";

const Msg = ({ state }: { state: FormState }) =>
  state && (state.error || state.message) ? (
    <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
      {state.error ?? state.message}
    </p>
  ) : null;

/** Add one player (name + number), or the manager / coach (name). */
export function AddPersonForm({ id, entryId, role }: { id: string; entryId: string; role: "player" | "manager" | "coach" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addRosterPersonAction.bind(null, id, entryId), null);
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setName("");
      setJersey("");
    }
  }, [state]);
  const fe = state?.fieldErrors ?? {};
  const label = { player: "Add a player", manager: "Add the manager", coach: "Add the coach" }[role];
  const p = `${role}-new`;
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-dashed border-border p-3">
      <input type="hidden" name="role" value={role} />
      <p className="text-sm font-semibold">{label}</p>
      <div className={`grid gap-2 ${role === "player" ? "grid-cols-[5.5rem_minmax(0,1fr)]" : ""}`}>
        {role === "player" && (
          <Field id={`${p}-jersey`} label="Number" error={fe.jersey}>
            <Input id={`${p}-jersey`} name="jersey" value={jersey} onChange={(e) => setJersey(e.target.value)} inputMode="numeric" maxLength={3} error={fe.jersey} />
          </Field>
        )}
        <Field id={`${p}-name`} label={role === "player" ? "Player name" : `${role === "manager" ? "Manager" : "Coach"} name`} error={fe.name ?? fe.role}>
          <Input id={`${p}-name`} name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" error={fe.name ?? fe.role} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass("secondary", "md")} disabled={pending} aria-busy={pending}>
          <Plus aria-hidden />
          {pending ? "Adding…" : "Add"}
        </button>
        <Msg state={state?.fieldErrors ? null : state} />
      </div>
    </form>
  );
}

/** Tick players from the Clbx team; numbers come from their team profile and can be changed. */
export function PickFromTeam({ id, entryId, players, room }: { id: string; entryId: string; players: { userId: string | null; name: string; jersey: number | null }[]; room: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addFromTeamAction.bind(null, id, entryId), null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (state?.ok) setPicked(new Set());
  }, [state]);
  const list = players.filter((p) => p.userId);
  const full = room != null && picked.size >= room;
  return (
    <details className="rounded-lg border border-border">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-3 font-semibold">
        <Users aria-hidden className="size-4" />
        Add from your team ({list.length})
      </summary>
      <form action={action} className="grid gap-2 border-t border-border p-3">
        <p className="text-xs text-muted">Tick who&apos;s playing. Numbers come from your team; change any that differ.</p>
        <ul className="grid gap-1.5">
          {list.map((p) => {
            const uid = p.userId!;
            const on = picked.has(uid);
            return (
              <li key={uid} className="flex items-center gap-2.5">
                <input
                  id={`pick-${uid}`}
                  type="checkbox"
                  name="pick"
                  value={uid}
                  checked={on}
                  disabled={!on && full}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(uid);
                    else next.delete(uid);
                    setPicked(next);
                  }}
                  className="size-5 shrink-0 accent-[var(--team)]"
                />
                <label htmlFor={`pick-${uid}`} className="min-w-0 flex-1 text-sm break-words">
                  {p.name}
                </label>
                <input type="hidden" name={`name_${uid}`} value={p.name} />
                <label className="sr-only" htmlFor={`pick-j-${uid}`}>
                  Number for {p.name}
                </label>
                <span className="w-16 shrink-0">
                  <input id={`pick-j-${uid}`} name={`jersey_${uid}`} defaultValue={p.jersey ?? ""} placeholder="#" inputMode="numeric" maxLength={3} className={`${inputClass} h-10 px-2 text-center`} />
                </span>
              </li>
            );
          })}
        </ul>
        {full && <p className="text-xs text-muted">That fills the roster.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("primary", "md")} disabled={pending || picked.size === 0} aria-busy={pending}>
            {pending ? "Adding…" : `Add ${picked.size || ""} ${picked.size === 1 ? "player" : "players"}`.replace("  ", " ")}
          </button>
          <Msg state={state} />
        </div>
      </form>
    </details>
  );
}

/** Edit or remove one person. */
export function PersonActions({ id, entryId, person, warnMark }: { id: string; entryId: string; person: { id: string; name: string; jersey: number | null; role: string }; warnMark: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(editRosterPersonAction.bind(null, id, entryId, person.id), null);
  const [removing, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const fe = state?.fieldErrors ?? {};
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open)
    return (
      <span className="flex shrink-0 gap-1">
        <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${person.name}`} className="grid size-10 place-items-center rounded-md border border-border">
          <Pencil aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          disabled={removing}
          aria-label={`Remove ${person.name}`}
          onClick={() => {
            if (!confirm(warnMark ? `Remove ${person.name}? It will show on the roster as removed by the host.` : `Remove ${person.name} from the roster?`)) return;
            start(async () => setErr((await removeRosterPersonAction(id, entryId, person.id))?.error ?? null));
          }}
          className="grid size-10 place-items-center rounded-md border border-border text-danger"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
        {err && (
          <span role="alert" className="sr-only">
            {err}
          </span>
        )}
      </span>
    );
  const p = `edit-${person.id}`;
  return (
    <form action={action} className="grid basis-full gap-2">
      <div className={`grid gap-2 ${person.role === "player" ? "grid-cols-[5rem_minmax(0,1fr)]" : ""}`}>
        {person.role === "player" && (
          <Field id={`${p}-j`} label="Number" error={fe.jersey}>
            <Input id={`${p}-j`} name="jersey" defaultValue={person.jersey ?? ""} inputMode="numeric" maxLength={3} error={fe.jersey} />
          </Field>
        )}
        <Field id={`${p}-n`} label="Name" error={fe.name}>
          <Input id={`${p}-n`} name="name" defaultValue={person.name} maxLength={80} error={fe.name} />
        </Field>
      </div>
      {warnMark && <p className="text-xs text-muted">This will show on the roster as changed by the host.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass("primary", "md")} disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-muted">
          Done
        </button>
        <Msg state={state?.fieldErrors ? null : state} />
      </div>
    </form>
  );
}

export function SubmitRoster({ id, entryId, criteria, players, min, forTeam }: { id: string; entryId: string; criteria: boolean; players: number; min: number; forTeam: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRosterAction.bind(null, id, entryId), null);
  const short = players < min;
  return (
    <section aria-labelledby="submit-h" className="grid gap-3 rounded-lg border border-border p-4">
      <h3 id="submit-h" className="text-lg font-semibold">
        Submit the roster
      </h3>
      <p className="text-sm text-muted">
        {forTeam ? "Submit it for this team once it's complete. " : ""}Once submitted, the team can&apos;t make any more changes. Only the host can, and their changes are marked on the roster.
      </p>
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm("Submit the roster? You won't be able to change it after this.")) e.preventDefault();
        }}
        className="grid gap-3"
      >
        {criteria && (
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="confirm" className="mt-0.5 size-5 shrink-0 accent-[var(--team)]" />
            <span>Every player on this roster meets the player criteria above.</span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass("primary")} disabled={pending || short} aria-busy={pending}>
            {pending ? "Submitting…" : "Submit roster"}
          </button>
          {short && <span className="text-xs text-muted">Add at least {min} {min === 1 ? "player" : "players"} first.</span>}
        </div>
        <Msg state={state} />
      </form>
    </section>
  );
}

/** Pick the team's captain from the players on the roster. */
export function CaptainPicker({ id, entryId, players, current, warnMark }: { id: string; entryId: string; players: { id: string; label: string }[]; current: string | null; warnMark: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setCaptainAction.bind(null, id, entryId), null);
  const [value, setValue] = useState(current ?? "");
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-border p-3">
      <label htmlFor="captain" className="text-sm font-semibold">
        Captain
      </label>
      <div className="flex gap-2">
        <select id="captain" name="captain" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} min-w-0 flex-1`}>
          <option value="">Not chosen</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary", "md", "shrink-0")} disabled={pending || value === (current ?? "")} aria-busy={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {warnMark && <p className="text-xs text-muted">A new captain shows on the roster as changed by the host.</p>}
      <Msg state={state} />
    </form>
  );
}
