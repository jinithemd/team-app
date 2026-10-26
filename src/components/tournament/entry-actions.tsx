"use client";

import { useActionState, useTransition, useState } from "react";
import { applyAction, withdrawAction } from "@/app/tournament-actions";
import type { FormState } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";

/** Enter one of my teams (captains and managers). */
export function ApplyForm({ id, teams }: { id: string; teams: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyAction.bind(null, id), null);
  if (state?.ok) return <p role="status" className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-success">{state.message}</p>;
  return (
    <form action={action} className="grid gap-2 rounded-lg border-2 border-team p-4">
      <h2 className="font-semibold">Enter a team</h2>
      <p className="text-sm text-muted">The organizers accept each entry.</p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="apply-team" className="sr-only">
          Team
        </label>
        <select id="apply-team" name="teamId" className={`${inputClass} min-w-0 flex-1`}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className={buttonClass("primary")} disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : "Send entry"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function WithdrawButton({ id, entryId }: { id: string; entryId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Withdraw your team from this tournament?")) return;
          start(async () => setMsg((await withdrawAction(id, entryId))?.error ?? null));
        }}
        className="text-sm font-semibold text-danger"
      >
        Withdraw
      </button>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </span>
  );
}
