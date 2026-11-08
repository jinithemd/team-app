"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createGroupAction } from "@/app/group-actions";
import { Button, Field, Input, buttonClass } from "@/components/ui";

export function NewGroup({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState(createGroupAction.bind(null, teamId), null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "md", "w-full")}>
        <Plus aria-hidden />
        New group
      </button>
    );
  return (
    <form action={act} aria-labelledby="ng-h" className="grid gap-3 rounded-lg border border-border p-4">
      <h3 id="ng-h" className="font-semibold">
        New group
      </h3>
      <Field label="Name" id="name">
        <Input id="name" name="name" required maxLength={60} placeholder="e.g. Sunday Fun" autoFocus />
      </Field>
      <Field label="What it's for (optional)" id="about">
        <Input id="about" name="about" maxLength={300} placeholder="e.g. Sunday 9am, Caraco Park, all levels" />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Making it…" : "Make group"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
