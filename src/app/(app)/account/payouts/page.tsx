import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Landmark, ShieldCheck } from "lucide-react";
import { myPayouts } from "@/lib/payments/service";
import { FEE_FIXED_CENTS, FEE_PERCENT, cad } from "@/lib/payments/pricing";
import { Banner, PageHeader } from "@/components/ui";
import { DemoPayoutSetup, PayoutSetup } from "./embedded";

export const metadata: Metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const v = await myPayouts();
  return (
    <main id="main" className="gutter mx-auto grid max-w-2xl gap-5 py-6">
      <PageHeader title="Payouts" subtitle="Get paid online for dues, game fees and tournament entries." />
      {!v.enabled ? (
        <Banner tone="info">Online payments aren&apos;t switched on yet. Check back soon.</Banner>
      ) : (
        <>
          {v.ready ? (
            <p className="flex items-start gap-2 rounded-md bg-success-soft p-3 text-sm">
              <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Your payout account is ready.</strong> Turn on online payments on your team&apos;s Dues page, or on a tournament you host.
                {v.received.count > 0 && ` You've received ${cad(v.received.cents)} from ${v.received.count} ${v.received.count === 1 ? "payment" : "payments"}.`}
              </span>
            </p>
          ) : (
            <section className="grid gap-2 text-sm">
              <p>Set this up once and you can collect for any team or tournament you run. It takes about 5 minutes. You&apos;ll need:</p>
              <ul className="grid gap-1 pl-5 [list-style:disc]">
                <li>Your name, date of birth, home address and phone</li>
                <li>Your SIN (Stripe uses it to confirm who you are)</li>
                <li>The bank account the money should go to</li>
              </ul>
              <p className="text-muted">You don&apos;t need a business or a business number.</p>
            </section>
          )}
          {v.demo ? !v.ready && <DemoPayoutSetup /> : <PayoutSetup publishableKey={v.publishableKey!} ready={v.ready} />}
          <section className="grid gap-2 rounded-lg border border-border p-4 text-sm">
            <p className="flex items-start gap-2">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              <span>Payments are handled by Stripe. Your ID, SIN and bank details go to Stripe, not to Clbx.</span>
            </p>
            <p className="flex items-start gap-2">
              <Landmark aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                You get the full amount you charge. Players pay a {FEE_PERCENT}% + {FEE_FIXED_CENTS}¢ online fee on top (on a $50 fee they pay $52.50). Money reaches your bank in about 2 business days; the very first payout can take up to 7.
              </span>
            </p>
          </section>
          <p className="text-sm">
            <Link href="/account" className="font-semibold text-team-ink underline">
              Back to Account
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
