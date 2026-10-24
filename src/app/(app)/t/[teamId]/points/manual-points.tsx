"use client";

import { useActionState } from "react";
import { addPointsAction, removePointsAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";

export function ManualPoints({ teamId, players }: { teamId: string; players: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addPointsAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px]" noValidate>
      <Field id="userId" label="Player" error={fe.userId}>
        <select id="userId" name="userId" className={inputClass} defaultValue="">
          <option value="" disabled>
            Pick a player
          </option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="points" label="Points" error={fe.points}>
        <Input id="points" name="points" type="number" min={-100} max={100} defaultValue="5" error={fe.points} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="note" label="What for" error={fe.note}>
          <Input id="note" name="note" maxLength={140} placeholder="e.g. Ran the kit wash all season" error={fe.note} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className={buttonClass("secondary")} disabled={pending}>
          {pending ? "Adding…" : "Add points"}
        </button>
        <span role="status" className={`text-sm ${state?.error ? "text-danger" : "text-success"}`}>
          {state?.error ?? (state?.ok ? state.message : "")}
        </span>
      </div>
    </form>
  );
}

export function RemovePoints({ teamId, pointsId }: { teamId: string; pointsId: string }) {
  const [, action, pending] = useActionState<FormState, FormData>(removePointsAction.bind(null, teamId, pointsId), null);
  return (
    <form action={action}>
      <button className="min-h-8 text-xs font-semibold text-muted hover:text-danger" disabled={pending}>
        Remove
      </button>
    </form>
  );
}
