"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFeeAction, confirmPaymentAction, remindUnpaidAction, reportPaymentAction, type FormState } from "@/app/actions";
import { Button, Field, Input, buttonClass, inputClass } from "@/components/ui";

export function ReportPayment({ teamId, dueId, left }: { teamId: string; dueId: string; left: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportPaymentAction.bind(null, teamId, dueId), null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) return <p role="status" className="text-sm font-medium text-success">{state.message}</p>;
  return (
    <form action={action} className="grid gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`amount-${dueId}`} label="Amount" error={fe.amount}>
          <Input id={`amount-${dueId}`} name="amount" inputMode="decimal" defaultValue={String(left)} error={fe.amount} />
        </Field>
        <Field id={`method-${dueId}`} label="How" error={fe.method}>
          <select id={`method-${dueId}`} name="method" defaultValue="etransfer" className={inputClass}>
            <option value="etransfer">e-Transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field id={`ref-${dueId}`} label="Reference (optional)" hint="Helps the treasurer match it">
        <Input id={`ref-${dueId}`} name="ref" maxLength={40} />
      </Field>
      {state?.error && !Object.keys(fe).length && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={buttonClass("primary", "md", "justify-self-start")} disabled={pending}>
        I&apos;ve paid
      </button>
    </form>
  );
}

export function ConfirmRow({ teamId, paymentId, label, sub }: { teamId: string; paymentId: string; label: string; sub: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const go = (accept: boolean) =>
    start(async () => {
      const r = await confirmPaymentAction(teamId, paymentId, accept);
      if (!r.ok) setErr(r.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="min-w-0 flex-1 text-sm">
        <strong>{label}</strong>
        <span className="block text-muted">{sub}</span>
        {err && <span className="block text-danger">{err}</span>}
      </span>
      <Button size="sm" disabled={pending} onClick={() => go(true)}>
        Confirm
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go(false)}>
        Can&apos;t find it
      </Button>
    </div>
  );
}

export function AddFee({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(addFeeAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add a fee
      </Button>
    );
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-border p-4 sm:col-span-2" noValidate>
      <h3 className="font-semibold">Add a fee for every player</h3>
      <Field id="fee-name" label="What for" error={fe.name}>
        <Input id="fee-name" name="name" maxLength={80} placeholder="Season fee, kit, tournament entry" error={fe.name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="fee-amount" label="Each player pays" error={fe.amount}>
          <Input id="fee-amount" name="amount" inputMode="decimal" placeholder="120" error={fe.amount} />
        </Field>
        <Field id="fee-due" label="Due by (optional)" error={fe.dueOn}>
          <Input id="fee-due" name="dueOn" type="date" error={fe.dueOn} />
        </Field>
      </div>
      {state?.error && !Object.keys(fe).length && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm font-medium text-success">{state.message}</p>}
      <button className={buttonClass("primary", "md", "justify-self-start")} disabled={pending}>
        Add fee
      </button>
    </form>
  );
}

export function Remind({ teamId, count }: { teamId: string; count: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(remindUnpaidAction.bind(null, teamId), null);
  return (
    <form action={action} className="grid gap-1">
      <button className={buttonClass("primary", "md", "w-full")} disabled={pending}>
        Remind {count === 1 ? "them" : `all ${count}`}
      </button>
      {state?.message && <p role="status" className="text-sm text-success">{state.message}</p>}
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
