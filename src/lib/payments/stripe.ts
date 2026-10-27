import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * The few Stripe API calls Clbx makes, over plain fetch (no SDK). Keys come from Vercel:
 *   STRIPE_SECRET_KEY                    sk_live_… / sk_test_…
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   pk_live_… / pk_test_… (the embedded payout form)
 *   STRIPE_WEBHOOK_SECRET                whsec_… for https://clbx.ca/api/stripe/webhook
 */

export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

type Params = Record<string, unknown>;

/** Stripe's form encoding: a[b][0][c]=v */
function encode(params: Params, prefix = "", out: string[] = []) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? encode(x as Params, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`)));
    else if (typeof v === "object") encode(v as Params, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export class StripeError extends Error {}

async function call<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params?: Params, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Online payments aren't switched on yet.");
  const body = params ? encode(params).join("&") : undefined;
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) {
    console.error(`[stripe] ${method} ${path}: ${res.status} ${json.error?.message}`);
    throw new StripeError(json.error?.message || "Stripe didn't accept that. Try again.");
  }
  return json;
}

export interface StripeAccount {
  id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  capabilities?: Record<string, string>;
  requirements?: { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null };
}

/** A payout account with no Stripe dashboard: everything happens inside Clbx (like Spond). */
export function createAccount(input: { email: string; firstName: string; lastName: string; url: string; userId: string }) {
  return call<StripeAccount>("POST", "accounts", {
    country: "CA",
    email: input.email,
    controller: { stripe_dashboard: { type: "none" } },
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_profile: { url: input.url, mcc: "7941", product_description: "Amateur sports team fees: season dues, game fees and tournament entries collected through Clbx." },
    individual: { email: input.email, first_name: input.firstName, last_name: input.lastName },
    metadata: { clbx_user: input.userId },
  }, `acct-${input.userId}`);
}

export const getAccount = (id: string) => call<StripeAccount>("GET", `accounts/${id}`);

export function accountSession(accountId: string) {
  return call<{ client_secret: string }>("POST", "account_sessions", {
    account: accountId,
    components: {
      account_onboarding: { enabled: true, features: { external_account_collection: true } },
      account_management: { enabled: true, features: { external_account_collection: true } },
      notification_banner: { enabled: true, features: { external_account_collection: true } },
      payouts: { enabled: true, features: { instant_payouts: false, standard_payouts: true, edit_payout_schedule: true, external_account_collection: true } },
    },
  });
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  metadata?: Record<string, string>;
}

/**
 * A destination charge on Clbx: the player pays the total, the payout account gets exactly
 * the amount, and Clbx keeps its fee (Stripe's fee comes out of that).
 */
export function createCheckout(input: {
  paymentId: string;
  destination: string;
  amountCents: number;
  feeCents: number;
  label: string;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  return call<CheckoutSession>("POST", "checkout/sessions", {
    mode: "payment",
    customer_email: input.email ?? undefined,
    client_reference_id: input.paymentId,
    line_items: [
      { quantity: 1, price_data: { currency: "cad", unit_amount: input.amountCents, product_data: { name: input.label.slice(0, 120) } } },
      { quantity: 1, price_data: { currency: "cad", unit_amount: input.feeCents, product_data: { name: "Online payment fee" } } },
    ],
    payment_intent_data: {
      application_fee_amount: input.feeCents,
      transfer_data: { destination: input.destination },
      description: input.label.slice(0, 200),
      metadata: { clbx_payment: input.paymentId },
    },
    metadata: { clbx_payment: input.paymentId },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  }, `checkout-${input.paymentId}`);
}

export const getCheckout = (id: string) => call<CheckoutSession>("GET", `checkout/sessions/${encodeURIComponent(id)}`);

/** Checks the Stripe-Signature header (HMAC-SHA256 of "<t>.<body>", 5 minutes' tolerance). */
export function verifyWebhook(body: string, header: string | null, secrets: string[]): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  for (const secret of secrets) {
    const want = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    for (const s of sigs) {
      if (s.length === want.length && timingSafeEqual(Buffer.from(s), Buffer.from(want))) return true;
    }
  }
  return false;
}
