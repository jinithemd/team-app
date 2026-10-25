"use client";

import { useActionState } from "react";
import { signInLinkAction, signUpAction, type FormState } from "../actions";
import { Field, Input, buttonClass } from "@/components/ui";

/** After an email link is sent (live build). */
export function CheckEmail({ email }: { email: string }) {
  return (
    <div role="status" className="grid gap-1 rounded-md bg-surface p-3.5">
      <p className="font-semibold">Check your email</p>
      <p className="text-sm">
        We sent a sign-in link to <span className="font-semibold break-all">{email}</span>. Open it on this device. It works once, within an hour.
      </p>
      <p className="text-xs text-muted">Nothing there? Check spam, or wait a minute and try again.</p>
    </div>
  );
}

/** Live build: an existing account signs in with a link. */
export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInLinkAction, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok && state.message) return <CheckEmail email={state.message} />;
  return (
    <form action={action} className="grid gap-3" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="signin-email" label="Email" error={fe.email}>
        <Input id="signin-email" name="email" type="email" autoComplete="email" inputMode="email" error={fe.email} required />
      </Field>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok && state.message) return <CheckEmail email={state.message} />;
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
