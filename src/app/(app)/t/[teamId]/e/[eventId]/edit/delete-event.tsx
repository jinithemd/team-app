"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteEventAction, type FormState } from "@/app/actions";
import { Button, buttonClass } from "@/components/ui";

export function DeleteEvent({ eventId, inSeries }: { eventId: string; inSeries: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteEventAction.bind(null, eventId), null);
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="del-h" className="grid gap-3 border-t border-border pt-5">
      <h3 id="del-h" className="text-sm font-semibold">
        Delete
      </h3>
      {!open ? (
        <Button variant="secondary" size="sm" className="justify-self-start text-danger" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          Delete this event
        </Button>
      ) : (
        <form action={action} className="grid gap-3 rounded-md bg-danger-soft p-3">
          <p className="text-sm">Deleting removes it and everyone&apos;s answers. To keep a record, cancel it instead.</p>
          {inSeries && (
            <div className="grid gap-1 text-sm">
              <label className="flex min-h-9 items-center gap-2.5">
                <input type="radio" name="scope" value="one" defaultChecked className="size-4" />
                Only this one
              </label>
              <label className="flex min-h-9 items-center gap-2.5">
                <input type="radio" name="scope" value="following" className="size-4" />
                This and the following weeks
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass("danger", "sm")} disabled={pending} aria-busy={pending}>
              {pending ? "Deleting…" : "Delete"}
            </button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
