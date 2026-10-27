"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectAccountManagement, ConnectAccountOnboarding, ConnectComponentsProvider, ConnectNotificationBanner, ConnectPayouts } from "@stripe/react-connect-js";
import { demoPayoutSetupAction, payoutSessionAction, refreshPayoutsAction } from "@/app/payment-actions";
import { Banner, Button } from "@/components/ui";

// Stripe's own payout form and account screens, drawn inside Clbx in the app's colours.
// The details typed here go straight to Stripe; Clbx never sees the SIN, ID or bank number.

function themeVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function PayoutSetup({ publishableKey, ready }: { publishableKey: string; ready: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const instance = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const r = await payoutSessionAction();
        if (!r.clientSecret) {
          setError(r.error ?? "Couldn't open the payout form.");
          throw new Error(r.error);
        }
        return r.clientSecret;
      },
      locale: "en-CA",
      appearance: {
        overlays: "dialog",
        variables: {
          colorPrimary: themeVar("--accent", "#1d4ed8"),
          colorBackground: themeVar("--bg", "#ffffff"),
          colorText: themeVar("--text", "#111827"),
          colorSecondaryText: themeVar("--text-muted", "#4b5563"),
          colorBorder: themeVar("--border-input", "#9ca3af"),
          colorDanger: themeVar("--danger", "#b91c1c"),
          borderRadius: "8px",
          fontFamily: "Inter, system-ui, sans-serif",
        },
      },
    });
  }, [publishableKey]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !instance) return <p className="text-sm text-muted">Loading the secure form…</p>;
  return (
    <div className="grid gap-4">
      {error && <Banner tone="danger">{error}</Banner>}
      <ConnectComponentsProvider connectInstance={instance}>
        {ready ? (
          <>
            <ConnectNotificationBanner />
            <section aria-label="Money paid out" className="grid gap-2">
              <ConnectPayouts />
            </section>
            <section aria-label="Payout account details" className="grid gap-2">
              <ConnectAccountManagement />
            </section>
          </>
        ) : (
          <ConnectAccountOnboarding
            privacyPolicyUrl="https://clbx.ca/privacy"
            fullTermsOfServiceUrl="https://clbx.ca/terms"
            onExit={() => {
              void refreshPayoutsAction().then(() => router.refresh());
            }}
          />
        )}
      </ConnectComponentsProvider>
    </div>
  );
}

/** Sample build: the payout form, pretend version. */
export function DemoPayoutSetup() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      <p className="text-sm text-muted">
        In the real app this is Stripe&apos;s form: your name, date of birth, address, phone, SIN and bank account. This sample build skips it.
      </p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await demoPayoutSetupAction();
          router.refresh();
        }}
        className="justify-self-start"
      >
        Finish payout setup (sample)
      </Button>
    </div>
  );
}
