"use client";

import { useActionState, useState } from "react";
import { createClubAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { ColorField } from "../../teams/new/create-team-form";

export function CreateClubForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createClubAction, null);
  const fe = state?.fieldErrors ?? {};
  const [color, setColor] = useState("#0F5C3A");
  const [secondary, setSecondary] = useState<string | null>("#F2C14E");
  return (
    <form action={action} className="grid gap-6" noValidate>
      <Field id="name" label="Club name" error={fe.name}>
        <Input id="name" name="name" maxLength={80} placeholder="e.g. Limestone City FC" error={fe.name} />
      </Field>
      <ColorField label="Club colour" name="color" value={color} onChange={(v) => v && setColor(v)} error={fe.color} />
      <ColorField label="Second colour" name="colorSecondary" value={secondary} onChange={setSecondary} optional />
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Setting up…" : "Create club"}
      </button>
    </form>
  );
}
