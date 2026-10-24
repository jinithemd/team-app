"use client";

import { useActionState, useState } from "react";
import { requestToJoinAction, type FormState } from "@/app/actions";
import { Button, buttonClass, inputClass } from "@/components/ui";

export function AskToJoin({ teamId, path }: { teamId: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(requestToJoinAction.bind(null, teamId, path), null);
  if (state?.ok) return <p role="status" className="text-sm font-semibold text-success">{state.message}</p>;
  if (!open)
    return (
      <Button size="sm" className="justify-self-start" onClick={() => setOpen(true)}>
        Ask to join
      </Button>
    );
  return (
    <form action={action} className="grid gap-2">
      <label className="grid gap-1 text-sm font-semibold">
        A line for the captain <span className="font-normal text-muted">(optional)</span>
        <textarea name="message" rows={2} maxLength={300} placeholder="Where you've played, which position, when you're free" className={`${inputClass} py-2`} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={buttonClass("primary", "sm", "justify-self-start")} disabled={pending}>
        Send request
      </button>
    </form>
  );
}
