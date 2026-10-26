"use client";

import { useActionState, useState, useTransition } from "react";
import { addOfficialAction, deleteTournamentAction, removeOfficialAction, setStatusAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";
import type { Official, TournamentStatus } from "@/lib/tournaments/types";

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
