"use client";

import { useActionState } from "react";
import { acceptInviteAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { CheckEmail } from "@/app/login/sign-up-form";

export function AcceptForm({ token, email, hasAccount, signedInAsOther }: { token: string; email: string; hasAccount: boolean; signedInAsOther: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAction.bind(null, token), null);
  if (state?.ok && state.message) return <CheckEmail email={state.message} next={`/invite/${token}`} />;
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border bg-bg p-4" noValidate>
      <p className="text-sm">
        Joining as <span className="font-semibold break-all">{email}</span>
        {signedInAsOther && <span className="block text-xs text-muted">You&apos;ll be switched to this account.</span>}
      </p>
      {!hasAccount && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="firstName" label="Your first name">
            <Input id="firstName" name="firstName" autoComplete="given-name" />
          </Field>
          <Field id="lastName" label="Your last name">
            <Input id="lastName" name="lastName" autoComplete="family-name" />
          </Field>
        </div>
      )}
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending} aria-busy={pending}>
        {pending ? "Joining…" : "Join the team"}
      </button>
    </form>
  );
}
