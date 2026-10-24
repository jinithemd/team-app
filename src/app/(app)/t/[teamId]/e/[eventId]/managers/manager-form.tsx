"use client";

import { useActionState } from "react";
import { setEventManagerAction, type FormState } from "@/app/actions";
import { EVENT_PERMISSIONS, EVENT_PERMISSION_LABEL, type Person } from "@/lib/data/types";
import { buttonClass, inputClass } from "@/components/ui";

export function ManagerForm({ teamId, eventId, people, remove }: { teamId: string; eventId: string; people: Person[]; remove?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setEventManagerAction.bind(null, teamId, eventId), null);
  if (remove)
    return (
      <form action={action} className="mt-2">
        <input type="hidden" name="userId" value={people[0].id} />
        <button className={buttonClass("ghost", "sm")} disabled={pending}>
          Remove
        </button>
      </form>
    );
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4">
      <label className="grid gap-1.5 text-sm font-semibold">
        Who
        <select name="userId" className={inputClass} required>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-semibold">What they can do on this event</legend>
        {EVENT_PERMISSIONS.map((p) => (
          <label key={p} className="flex min-h-10 items-center gap-2.5 text-sm">
            <input type="checkbox" name="perm" value={p} defaultChecked className="size-4 accent-[var(--team)]" />
            {EVENT_PERMISSION_LABEL[p]}
          </label>
        ))}
      </fieldset>
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm font-medium text-success">{state.message}</p>}
      <button className={buttonClass("primary", "md", "justify-self-start")} disabled={pending}>
        Make them event manager
      </button>
    </form>
  );
}
