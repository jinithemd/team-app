"use client";

import { useActionState } from "react";
import { joinByLinkAction, type FormState } from "@/app/actions";
import { buttonClass } from "@/components/ui";

export function JoinButton({ token, label }: { token: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinByLinkAction.bind(null, token), null);
  return (
    <form action={action} className="grid gap-2">
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      <button className={buttonClass("primary", "lg", "w-full")} disabled={pending}>
        {pending ? "Joining…" : label}
      </button>
    </form>
  );
}
