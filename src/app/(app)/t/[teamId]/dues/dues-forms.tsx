"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addFeeAction,
  confirmPaymentAction,
  duesFixAction,
  remindUnpaidAction,
  reportPaymentAction,
  type FormState,
} from "@/app/actions";
import { Button, Field, Input, buttonClass, inputClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";

export function ReportPayment({
  teamId,
  dueId,
  left,
}: {
  teamId: string;
  dueId: string;
  left: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    reportPaymentAction.bind(null, teamId, dueId),
    null
  );
  const fe = state?.fieldErrors ?? {};
  if (state?.ok)
    return (
      <p role="status" className="text-sm font-medium text-success">
        {state.message}
      </p>
    );
  return (
    <form action={action} className="grid gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`amount-${dueId}`} label="Amount" error={fe.amount}>
          <Input
            id={`amount-${dueId}`}
            name="amount"
            inputMode="decimal"
            defaultValue={String(left)}
            error={fe.amount}
          />
        </Field>
        <Field id={`method-${dueId}`} label="How" error={fe.method}>
          <select
            id={`method-${dueId}`}
            name="method"
            defaultValue="etransfer"
            className={inputClass}
          >
            <option value="etransfer">e-Transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field
        id={`ref-${dueId}`}
        label="Reference (optional)"
        hint="Helps the treasurer match it"
      >
        <Input id={`ref-${dueId}`} name="ref" maxLength={40} />
      </Field>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        className={buttonClass("primary", "md", "justify-self-start")}
        disabled={pending}
      >
        I&apos;ve paid
      </button>
    </form>
  );
}

export function ConfirmRow({
  teamId,
  paymentId,
  label,
  sub,
}: {
  teamId: string;
  paymentId: string;
  label: string;
  sub: string;
}) {
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
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => go(false)}
      >
        Can&apos;t find it
      </Button>
    </div>
  );
}

export function AddFee({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    addFeeAction.bind(null, teamId),
    null
  );
  const fe = state?.fieldErrors ?? {};
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add a fee
      </Button>
    );
  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-border p-4 sm:col-span-2"
      noValidate
    >
      <h3 className="font-semibold">Add a fee for every player</h3>
      <Field id="fee-name" label="What for" error={fe.name}>
        <Input
          id="fee-name"
          name="name"
          maxLength={80}
          placeholder="Season fee, kit, tournament entry"
          error={fe.name}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="fee-amount" label="Each player pays" error={fe.amount}>
          <Input
            id="fee-amount"
            name="amount"
            inputMode="decimal"
            placeholder="120"
            error={fe.amount}
          />
        </Field>
        <Field id="fee-due" label="Due by (optional)" error={fe.dueOn}>
          <Input id="fee-due" name="dueOn" type="date" error={fe.dueOn} />
        </Field>
      </div>
      {state?.error && !Object.keys(fe).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-medium text-success">
          {state.message}
        </p>
      )}
      <button
        className={buttonClass("primary", "md", "justify-self-start")}
        disabled={pending}
      >
        Add fee
      </button>
    </form>
  );
}

export function Remind({ teamId, count }: { teamId: string; count: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    remindUnpaidAction.bind(null, teamId),
    null
  );
  return (
    <form action={action} className="grid gap-1">
      <button
        className={buttonClass("primary", "md", "w-full")}
        disabled={pending}
      >
        Remind {count === 1 ? "them" : `all ${count}`}
      </button>
      {state?.message && (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

type FixKind = "deleteFee" | "markPaid" | "removeDue" | "undo";

function useFix(teamId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (kind: FixKind, id: string) =>
    start(async () => {
      const r = await duesFixAction(teamId, { kind, id });
      setErr(r.error ?? null);
      router.refresh();
    });
  const error = err && (
    <p role="alert" className="text-sm text-danger">
      {err}
    </p>
  );
  return { pending, run, error };
}

/** One fee in the list, with Delete for the treasurer. */
export function FeeRow({
  teamId,
  feeId,
  name,
  line,
}: {
  teamId: string;
  feeId: string;
  name: string;
  line: string;
}) {
  const { pending, run, error } = useFix(teamId);
  return (
    <li className="grid gap-1 py-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{line}</span>
        <ConfirmButton
          disabled={pending}
          ariaLabel={`Delete ${name}`}
          question={`Delete "${name}"? It comes off every player's balance, along with anything recorded against it.`}
          yes="Yes, delete it"
          onConfirm={() => run("deleteFee", feeId)}
          className="min-h-9 px-2 text-xs font-semibold text-danger"
        >
          {pending ? "Deleting…" : "Delete"}
        </ConfirmButton>
      </div>
      {error}
    </li>
  );
}

type Item = {
  dueId: string;
  fee: string;
  amount: number;
  left: number;
  payments: {
    id: string;
    amount: number;
    method: string;
    paidOn: string;
    confirmed: boolean;
  }[];
};
const money = (c: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: c % 100 ? 2 : 0,
  }).format(c / 100);
const METHOD: Record<string, string> = {
  etransfer: "e-Transfer",
  cash: "cash",
  card: "card",
  other: "other",
};

/** Under a player's row: each fee they owe, with Mark paid, Remove and Undo. */
export function PlayerDues({
  teamId,
  name,
  items,
}: {
  teamId: string;
  name: string;
  items: Item[];
}) {
  const { pending, run, error } = useFix(teamId);
  return (
    <div className="grid gap-3 pb-3">
      {items.map((it) => {
        const open =
          it.left -
          it.payments
            .filter((p) => !p.confirmed)
            .reduce((n, p) => n + p.amount, 0);
        return (
          <div
            key={it.dueId}
            className="grid gap-2 rounded-md bg-surface p-3 text-sm"
          >
            <p className="flex justify-between gap-2">
              <strong>{it.fee}</strong>
              <span className="tabular">
                {it.left
                  ? `${money(it.left)} left of ${money(it.amount)}`
                  : `Paid ${money(it.amount)}`}
              </span>
            </p>
            {it.payments.length > 0 && (
              <ul className="grid gap-1">
                {it.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-muted"
                  >
                    <span>
                      {money(p.amount)} by {METHOD[p.method] ?? p.method} on{" "}
                      {new Date(p.paidOn + "T12:00:00Z").toLocaleDateString(
                        "en-CA",
                        { month: "short", day: "numeric", timeZone: "UTC" }
                      )}
                      {p.confirmed ? "" : " · waiting to be confirmed"}
                    </span>
                    {p.method !== "card" && (
                      <ConfirmButton
                        disabled={pending}
                        ariaLabel={`Undo ${money(
                          p.amount
                        )} payment from ${name}`}
                        question={`Undo this ${money(
                          p.amount
                        )} payment? ${name} will owe it again.`}
                        yes="Undo payment"
                        onConfirm={() => run("undo", p.id)}
                        className="min-h-9 px-2 text-xs font-semibold text-danger"
                      >
                        Undo
                      </ConfirmButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {open > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run("markPaid", it.dueId)}
                  className={buttonClass("secondary", "sm")}
                >
                  Mark paid ({money(open)} cash)
                </button>
              )}
              <ConfirmButton
                disabled={pending}
                ariaLabel={`Remove ${name} from ${it.fee}`}
                question={`Take ${name} off "${it.fee}"? They won't owe it any more.`}
                yes="Yes, remove"
                onConfirm={() => run("removeDue", it.dueId)}
                className="min-h-9 px-2 text-sm font-semibold text-danger"
              >
                Remove from this fee
              </ConfirmButton>
            </div>
          </div>
        );
      })}
      {error}
    </div>
  );
}
