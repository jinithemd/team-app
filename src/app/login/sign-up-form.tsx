"use client";

import { useActionState } from "react";
import { signUpAction, type FormState } from "../actions";
import { Field, Input, buttonClass } from "@/components/ui";

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid grid-cols-2 gap-3">
        <Field id="firstName" label="First name" error={fe.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" error={fe.firstName} required />
        </Field>
        <Field id="lastName" label="Last name" error={fe.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" error={fe.lastName} required />
        </Field>
      </div>
      <Field id="email" label="Email" error={fe.email} hint="We'll send a sign-in link here.">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" error={fe.email} required />
      </Field>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending} aria-busy={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
      <p className="text-xs text-muted">Player, captain, manager or club owner, it&apos;s one account. You pick your roles when you start or join a team.</p>
    </form>
  );
}
