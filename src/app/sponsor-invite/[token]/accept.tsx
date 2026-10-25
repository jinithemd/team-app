"use client";

import { useActionState } from "react";
import { acceptSponsorInviteAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { CheckEmail } from "@/app/login/sign-up-form";

export function AcceptSponsor({ token, email, hasAccount }: { token: string; email: string; hasAccount: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptSponsorInviteAction.bind(null, token), null);
  if (state?.ok && state.message) return <CheckEmail email={state.message} />;
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border bg-bg p-4" noValidate>
      <p className="text-sm">
        Signing in as <span className="font-semibold break-all">{email}</span>
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
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending}>
        {pending ? "Opening…" : "Open my sponsor page"}
      </button>
    </form>
  );
}
