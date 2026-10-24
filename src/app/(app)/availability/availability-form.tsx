"use client";

import { useActionState, useState } from "react";
import { clearAvailabilityAction, saveAvailabilityAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";
import type { AvailabilityPeriod } from "@/lib/data/types";

const KINDS = [
  ["injured", "Injured"],
  ["away", "Away"],
  ["other", "Other"],
] as const;

export function AvailabilityForm({ teams, period }: { teams: { id: string; name: string }[]; period: AvailabilityPeriod | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAvailabilityAction.bind(null, period?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  const [kind, setKind] = useState<string>(period?.kind ?? "injured");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Why</legend>
        <input type="hidden" name="kind" value={kind} />
        <div role="radiogroup" aria-label="Why" className="grid grid-cols-3 gap-2">
          {KINDS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-12 rounded-md border text-sm font-semibold ${kind === k ? "border-2 border-team bg-team-soft text-team-ink" : "border-border-input bg-bg"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field id="startsOn" label="First day out" error={fe.startsOn}>
          <Input id="startsOn" name="startsOn" type="date" defaultValue={period?.startsOn ?? today} error={fe.startsOn} />
        </Field>
        <Field id="endsOn" label="Last day out" error={fe.endsOn}>
          <Input id="endsOn" name="endsOn" type="date" defaultValue={period?.endsOn ?? ""} error={fe.endsOn} />
        </Field>
      </div>
      <Field id="note" label="Note for captains (optional)" error={fe.note} hint="Only captains and managers see this.">
        <textarea id="note" name="note" rows={2} maxLength={300} defaultValue={period?.note ?? ""} placeholder="e.g. Hamstring, physio says 3 weeks" className={`${inputClass} py-2.5`} />
      </Field>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-semibold">Teams</legend>
        {teams.map((t) => (
          <label key={t.id} className="flex min-h-10 items-center gap-2.5 text-sm">
            <input type="checkbox" name="teamId" value={t.id} defaultChecked={period ? period.teamIds.includes(t.id) : true} className="size-5 accent-[var(--team)]" />
            {t.name}
          </label>
        ))}
        {fe.teamIds && <p className="text-xs font-medium text-danger">{fe.teamIds}</p>}
      </fieldset>
      <section aria-label="Who sees what" className="grid gap-1.5 rounded-md bg-surface p-3.5 text-sm">
        <p className="font-semibold">Who sees what</p>
        <p>
          <strong>Teammates</strong> see &ldquo;Unavailable&rdquo;. No reason, no note.
        </p>
        <p>
          <strong>Captains and managers</strong> see why and your note.
        </p>
        <p className="text-muted">We&apos;ll put you down as can&apos;t make it for events in these dates and skip reminders. You can still answer Going for any of them.</p>
      </section>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function ClearButton({ periodId }: { periodId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(clearAvailabilityAction.bind(null, periodId), null);
  return (
    <form action={action}>
      <button className="min-h-9 text-sm font-semibold text-danger" disabled={pending}>
        {pending ? "Clearing…" : "I'm back early, clear this"}
      </button>
      {state?.error && <span className="ml-2 text-sm text-danger">{state.error}</span>}
    </form>
  );
}
