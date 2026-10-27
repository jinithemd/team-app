import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Clock } from "lucide-react";
import { receipt } from "@/lib/payments/service";
import { cad } from "@/lib/payments/pricing";
import { PageHeader, buttonClass } from "@/components/ui";
import { DemoCard } from "./demo-card";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const r = await receipt(id, sp.session_id);
  if (!r) notFound();
  const p = r.payment;
  const paid = p.status === "paid";
  return (
    <main id="main" className="gutter mx-auto grid max-w-lg gap-5 py-6">
      <PageHeader title={paid ? "Paid" : "Payment"} subtitle={p.label ?? undefined} />
      <dl className="grid gap-1.5 rounded-lg border border-border p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Amount</dt>
          <dd className="tabular">{cad(p.amountCents)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Online fee</dt>
          <dd className="tabular">{cad(p.feeCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-semibold">
          <dt>Total</dt>
          <dd className="tabular">{cad(p.totalCents)}</dd>
        </div>
      </dl>
      {paid ? (
        <p className="flex items-start gap-2 rounded-md bg-success-soft p-3 text-sm">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            <strong>Payment received.</strong> It&apos;s marked as paid for your team. Stripe emails you a receipt.
          </span>
        </p>
      ) : r.demo && p.status === "pending" ? (
        <DemoCard paymentId={p.id} total={cad(p.totalCents)} />
      ) : (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{p.status === "pending" ? "We're waiting for Stripe to confirm the payment. Refresh in a moment." : "This payment didn't go through. Nothing was charged."}</span>
        </p>
      )}
      <Link href={r.back} className={buttonClass(paid ? "primary" : "secondary", "md", "justify-self-start")}>
        Done
      </Link>
    </main>
  );
}
