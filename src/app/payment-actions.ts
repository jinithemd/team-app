"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as pay from "@/lib/payments/service";
import type { PayKind } from "@/lib/payments/store";

// Thin server-action wrappers for online payments. Every rule is in lib/payments/service.ts.

export async function payoutSessionAction(): Promise<{ clientSecret?: string; error?: string }> {
  const r = await pay.payoutSession();
  return r.ok ? { clientSecret: r.data.clientSecret } : { error: r.error };
}

export async function demoPayoutSetupAction(): Promise<{ error?: string }> {
  const r = await pay.demoPayoutSetup();
  revalidatePath("/", "layout");
  return r.ok ? {} : { error: r.error };
}

/** After the embedded form closes: re-read the account from Stripe. */
export async function refreshPayoutsAction(): Promise<void> {
  await pay.myPayouts();
  revalidatePath("/", "layout");
}

export async function setCollectingAction(scope: "team" | "tournament", id: string, on: boolean): Promise<{ error?: string }> {
  const r = await pay.setMyCollecting(scope, id, on);
  revalidatePath("/", "layout");
  return r.ok ? {} : { error: r.error };
}

export async function startCheckoutAction(_: { error?: string } | null, f: FormData): Promise<{ error?: string } | null> {
  const kind = String(f.get("kind") ?? "") as PayKind;
  if (!["dues", "event", "tournament", "session"].includes(kind)) return { error: "Something went wrong. Try again." };
  const r = await pay.startCheckout({ kind, refId: String(f.get("refId") ?? ""), scopeId: String(f.get("scopeId") ?? "") });
  if (!r.ok) return { error: r.error };
  redirect(r.data.url);
}

export async function demoPayAction(paymentId: string): Promise<{ error?: string }> {
  const r = await pay.demoPay(paymentId);
  revalidatePath("/", "layout");
  return r.ok ? {} : { error: r.error };
}

export async function recordEventCashAction(eventId: string, userId: string, paid: boolean): Promise<{ error?: string }> {
  const r = await pay.recordEventCash(eventId, userId, paid);
  revalidatePath("/", "layout");
  return r.ok ? {} : { error: r.error };
}
