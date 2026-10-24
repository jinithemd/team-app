"use client";

import { useActionState } from "react";
import { joinByCodeAction, type FormState } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function JoinByCode() {
  const [state, action, pending] = useActionState<FormState, FormData>(joinByCodeAction, null);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex gap-2">
        <label htmlFor="code" className="sr-only">
          Team code
        </label>
        <input id="code" name="code" maxLength={12} autoCapitalize="characters" placeholder="8-letter code" className={`${inputClass} font-mono uppercase`} />
        <button className={buttonClass("secondary")} disabled={pending}>
          Join
        </button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
