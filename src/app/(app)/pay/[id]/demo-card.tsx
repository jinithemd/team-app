"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { demoPayAction } from "@/app/payment-actions";
import { Button } from "@/components/ui";

/** Sample build: stands in for Stripe's card page. */
export function DemoCard({ paymentId, total }: { paymentId: string; total: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      <p className="text-sm text-muted">Sample build: this is where Stripe&apos;s secure card page opens. No real card is charged.</p>
      <p className="rounded-md bg-sunken p-3 font-mono text-sm tabular">4242 4242 4242 4242 · 12/34 · 123</p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await demoPayAction(paymentId);
          setError(r.error ?? null);
          setBusy(false);
          router.refresh();
        }}
        className="justify-self-start"
      >
        <CreditCard aria-hidden />
        Pay {total}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
