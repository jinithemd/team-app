"use client";

import { useActionState } from "react";
import { createAuctionAction } from "@/app/auction-actions";
import type { FormState } from "@/app/actions";
import { Banner, Field, Input, buttonClass } from "@/components/ui";

export function NewAuctionForm({ teamId, players }: { teamId: string; players: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAuctionAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4" noValidate>
      <div>
        <h3 className="text-lg font-semibold">New player auction</h3>
        <p className="text-sm text-muted">Split your {players} players into teams for an internal tournament. Captains bid points for players; the top bid wins.</p>
      </div>
      {state?.error && !Object.keys(fe).length && <Banner tone="danger">{state.error}</Banner>}
      <Field id="title" label="Name" error={fe.title}>
        <Input id="title" name="title" maxLength={80} placeholder="e.g. Winter Cup auction" error={fe.title} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field id="squads" label="Teams" error={fe.squads}>
          <Input id="squads" name="squads" type="number" min={2} max={8} defaultValue="4" error={fe.squads} />
        </Field>
        <Field id="budget" label="Points per team" error={fe.budget}>
          <Input id="budget" name="budget" type="number" min={1} defaultValue="1000" error={fe.budget} />
        </Field>
        <Field id="basePrice" label="Base price" error={fe.basePrice} hint="Each player's starting bid. Change any player later.">
          <Input id="basePrice" name="basePrice" type="number" min={0} defaultValue="50" error={fe.basePrice} />
        </Field>
        <Field id="minIncrement" label="Bid steps of" error={fe.minIncrement}>
          <Input id="minIncrement" name="minIncrement" type="number" min={1} defaultValue="10" error={fe.minIncrement} />
        </Field>
        <Field id="bidSeconds" label="Seconds per player" error={fe.bidSeconds} hint="Each bid gives the others time to answer.">
          <Input id="bidSeconds" name="bidSeconds" type="number" min={5} max={300} defaultValue="20" error={fe.bidSeconds} />
        </Field>
        <Field id="squadMin" label="Min players per team" error={fe.squadMin}>
          <Input id="squadMin" name="squadMin" type="number" min={0} max={60} placeholder="0" error={fe.squadMin} />
        </Field>
        <Field id="squadMax" label="Max players per team" error={fe.squadMax}>
          <Input id="squadMax" name="squadMax" type="number" min={1} max={60} placeholder="No limit" error={fe.squadMax} />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 justify-self-start">
        <input type="checkbox" name="captainsPlay" defaultChecked className="size-5 accent-[var(--team)]" />
        <span className="text-sm">
          <span className="font-semibold">Captains play</span> <span className="text-muted">(each captain joins their team for free)</span>
        </span>
      </label>
      <button disabled={pending} className={buttonClass("primary", "md", "justify-self-start")}>
        {pending ? "Setting up…" : "Set up auction"}
      </button>
    </form>
  );
}
