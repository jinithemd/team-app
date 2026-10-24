"use client";

import { useActionState, useState } from "react";
import { sendTeamMessageAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";

export function ComposeForm({ teamId, people }: { teamId: string; people: { id: string; name: string; staff: boolean }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendTeamMessageAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  const [to, setTo] = useState("all");
  return (
    <form action={action} className="grid gap-5" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">To</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Everyone"],
              ["players", "Players"],
              ["staff", "Captains and staff"],
              ["chosen", "Choose people"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className={`inline-flex min-h-10 cursor-pointer items-center rounded-pill border px-3.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${to === v ? "border-team bg-team text-on-team" : "border-border-input"}`}>
              <input type="radio" name="to" value={v} checked={to === v} onChange={() => setTo(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        {to === "chosen" && (
          <div className="grid gap-1 rounded-md border border-border p-3 sm:grid-cols-2">
            {people.map((p) => (
              <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" name="recipient" value={p.id} className="size-4 accent-[var(--team)]" />
                {p.name}
              </label>
            ))}
          </div>
        )}
        {fe.to && <p className="text-xs font-medium text-danger">{fe.to}</p>}
      </fieldset>
      <Field id="subject" label="Subject" error={fe.subject}>
        <Input id="subject" name="subject" maxLength={140} placeholder="e.g. Kit order closes Friday" error={fe.subject} />
      </Field>
      <Field id="body" label="Message" error={fe.body}>
        <textarea id="body" name="body" rows={8} maxLength={5000} aria-invalid={fe.body ? true : undefined} className={`${inputClass} py-2.5`} />
      </Field>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="toSponsors" className="mt-1 size-4 accent-[var(--team)]" />
        <span>
          <span className="block text-sm font-semibold">Share with our sponsors too</span>
          <span className="block text-xs text-muted">For good news: results, cup runs, events they&apos;re invited to. Sponsors see it on their sponsor page.</span>
        </span>
      </label>
      {state?.error && !Object.keys(fe).length && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
      <p className="text-xs text-muted">It shows under Messages and goes by email to anyone who hasn&apos;t turned email off.</p>
    </form>
  );
}
