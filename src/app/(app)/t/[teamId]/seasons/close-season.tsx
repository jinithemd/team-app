"use client";

import { useActionState, useState } from "react";
import { closeSeasonAction, type FormState } from "@/app/actions";
import { Button, Field, Input, buttonClass } from "@/components/ui";

export function CloseSeasonForm({ teamId, defaultName, defaultStart, activeCount, series }: { teamId: string; defaultName: string; defaultStart: string; activeCount: number; series: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(closeSeasonAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  const [confirm, setConfirm] = useState(false);
  const box = (name: string, label: string, on: boolean) => (
    <label className="flex min-h-10 items-center gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} className="size-5 accent-[var(--team)]" />
      {label}
    </label>
  );
  return (
    <form action={action} className="grid gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="nextName" label="Next season" error={fe.nextName}>
          <Input id="nextName" name="nextName" maxLength={40} defaultValue={defaultName} error={fe.nextName} />
        </Field>
        <Field id="startsOn" label="Starts" error={fe.startsOn}>
          <Input id="startsOn" name="startsOn" type="date" defaultValue={defaultStart} error={fe.startsOn} />
        </Field>
      </div>
      <div className="grid">
        {box("copyRoster", `Keep the roster (${activeCount} active players)`, true)}
        {box("keepRoles", "Keep captains and roles", true)}
        {box("copyTrainings", series ? `Copy weekly trainings (${series})` : "Copy weekly trainings", series > 0)}
        {box("carryDues", "Carry over unpaid dues", false)}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {!confirm ? (
        <Button onClick={() => setConfirm(true)} className="justify-self-start">
          Close season
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft p-3">
          <span className="text-sm">This can&apos;t be undone.</span>
          <button className={buttonClass("primary", "sm")} disabled={pending} aria-busy={pending}>
            {pending ? "Closing…" : "Yes, close it"}
          </button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            Not yet
          </Button>
        </div>
      )}
    </form>
  );
}
