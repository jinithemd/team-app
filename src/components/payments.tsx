"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Landmark } from "lucide-react";
import { recordEventCashAction, setCollectingAction, startCheckoutAction } from "@/app/payment-actions";
import { buttonClass } from "./ui";

// Pay buttons and the "collect online payments" switch. Rules live in lib/payments/service.ts.

const cad = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayButton({
  kind,
  refId,
  scopeId,
  price,
  label = "Pay by card",
  full = false,
}: {
  kind: "dues" | "event" | "tournament";
  refId: string;
  scopeId: string;
  price: { amount: number; fee: number; total: number };
  label?: string;
  full?: boolean;
}) {
  const [state, action, pending] = useActionState(startCheckoutAction, null);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="refId" value={refId} />
      <input type="hidden" name="scopeId" value={scopeId} />
      <button disabled={pending} className={buttonClass("primary", "md", full ? "w-full" : "justify-self-start")}>
        <CreditCard aria-hidden />
        {pending ? "Opening…" : `${label} · ${cad(price.total)}`}
      </button>
      <span className="text-xs text-muted">
        {cad(price.amount)} + {cad(price.fee)} online fee
      </span>
      {state?.error && (
        <span role="alert" className="text-sm text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}

export interface CollectorInfo {
  enabled: boolean;
  active: boolean;
  name: string | null;
  isMe: boolean;
  canManage: boolean;
  myAccountReady: boolean;
}

/** For the treasurer or host: who online payments go to, and turning it on or off. */
export function CollectorPanel({ scope, id, info, what }: { scope: "team" | "tournament"; id: string; info: CollectorInfo; what: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!info.enabled) return null;
  const toggle = (on: boolean) =>
    start(async () => {
      const r = await setCollectingAction(scope, id, on);
      setError(r.error ?? null);
      router.refresh();
    });
  return (
    <section aria-labelledby={`collect-${id}`} className="grid gap-2 rounded-lg border border-border p-4">
      <h3 id={`collect-${id}`} className="flex items-center gap-2 font-semibold">
        <Landmark aria-hidden className="size-4" />
        Online payments
      </h3>
      {info.active ? (
        <p className="text-sm">
          <span className="font-semibold text-success">On.</span> Players can pay {what} by card. Money goes to {info.isMe ? "your" : `${info.name ?? "the treasurer"}'s`} payout account, the full amount, with the online fee paid by the player.
        </p>
      ) : info.name ? (
        <p className="text-sm text-warning">{info.name}&apos;s payout account needs attention, so card payments are paused.</p>
      ) : (
        <p className="text-sm text-muted">Let players pay {what} by card. You get the full amount; they pay a small online fee on top.</p>
      )}
      {info.canManage && (
        <div className="flex flex-wrap items-center gap-3">
          {info.isMe ? (
            <button type="button" disabled={pending} onClick={() => toggle(false)} className={buttonClass("secondary", "sm")}>
              Turn off
            </button>
          ) : info.myAccountReady ? (
            <button type="button" disabled={pending} onClick={() => toggle(true)} className={buttonClass("primary", "sm")}>
              {info.name ? "Collect into my account instead" : "Turn on: collect into my account"}
            </button>
          ) : (
            <Link href="/account/payouts" className={buttonClass("primary", "sm")}>
              Set up your payout account
            </Link>
          )}
          {info.isMe && (
            <Link href="/account/payouts" className="text-sm font-semibold text-team-ink underline">
              See payouts
            </Link>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/** Staff tick off a cash payment for an event fee. */
export function CashToggle({ eventId, userId, paid, name }: { eventId: string; userId: string; paid: "card" | "cash" | null; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (paid === "card") return <span className="rounded-pill bg-success-soft px-2 py-0.5 text-[11px] font-bold tracking-[.04em] text-success uppercase">Paid · card</span>;
  return (
    <span className="grid justify-items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={paid === "cash"}
        aria-label={paid === "cash" ? `${name} paid cash. Untick` : `Mark ${name} as paid cash`}
        onClick={() =>
          start(async () => {
            const r = await recordEventCashAction(eventId, userId, paid !== "cash");
            setError(r.error ?? null);
            router.refresh();
          })
        }
        className={`min-h-9 rounded-pill border px-3 text-xs font-bold ${paid === "cash" ? "border-success bg-success-soft text-success" : "border-border-input"}`}
      >
        {paid === "cash" ? "Paid · cash" : "Mark paid (cash)"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
