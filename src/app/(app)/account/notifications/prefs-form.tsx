"use client";

import { useActionState } from "react";
import { savePrefsAction, type FormState } from "@/app/actions";
import type { NotificationPrefs } from "@/lib/data/types";
import { buttonClass, inputClass } from "@/components/ui";

export function PrefsForm({ teamId, prefs }: { teamId: string; prefs: NotificationPrefs }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePrefsAction.bind(null, teamId), null);
  const row = (name: keyof NotificationPrefs, label: string, hint?: string) => (
    <label className="flex items-start gap-3 py-1.5">
      <input type="checkbox" name={name} defaultChecked={!!prefs[name]} className="mt-1 size-4 accent-[var(--team)]" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
  return (
    <form action={action} className="grid gap-1">
      {row("newEvents", "New games, trainings and events")}
      {row("changes", "Time or place changes")}
      {row("reminders", "Reminders to answer", "The day before, if you haven't said if you're in")}
      <label className="grid gap-1 py-1.5 text-sm font-semibold">
        Chat
        <select name="chat" defaultValue={prefs.chat} className={`${inputClass} sm:max-w-xs`}>
          <option value="all">Every message</option>
          <option value="mentions">Only when someone mentions me</option>
          <option value="off">Off</option>
        </select>
      </label>
      <div className="mt-1 flex flex-wrap gap-x-5 border-t border-border pt-2">
        {row("push", "Push on this phone")}
        {row("email", "Email")}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button className={buttonClass("secondary", "sm")} disabled={pending}>
          Save
        </button>
        {state?.message && <span role="status" className="text-sm text-success">{state.message}</span>}
        {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
