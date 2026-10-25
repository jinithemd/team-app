"use client";

import { useActionState } from "react";
import Link from "next/link";
import { deleteAccountAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4" noValidate>
      <Field
        id="confirmEmail"
        label={
          <>
            Type <span className="break-all">{email}</span> to confirm
          </>
        }
        error={fe.confirmEmail}
      >
        <Input id="confirmEmail" name="confirmEmail" type="email" autoComplete="off" inputMode="email" error={fe.confirmEmail} required />
      </Field>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass("danger")} disabled={pending} aria-busy={pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </button>
        <Link href="/account" className="text-sm font-semibold text-team-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}
