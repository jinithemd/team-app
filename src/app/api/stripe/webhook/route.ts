import { onAccountUpdated, onCheckoutPaid } from "@/lib/payments/service";
import { verifyWebhook, type CheckoutSession, type StripeAccount } from "@/lib/payments/stripe";

/*
 * Stripe → Clbx. Set up in Stripe (Developers → Webhooks) for https://clbx.ca/api/stripe/webhook:
 *   Your account:       checkout.session.completed, checkout.session.async_payment_succeeded
 *   Connected accounts: account.updated (optional: the payout page also checks on load)
 * Signing secrets go in STRIPE_WEBHOOK_SECRET (and STRIPE_CONNECT_WEBHOOK_SECRET if separate).
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((x): x is string => !!x);
  if (!secrets.length || !verifyWebhook(body, req.headers.get("stripe-signature"), secrets)) return new Response("Bad signature", { status: 400 });
  const event = JSON.parse(body) as { type: string; data: { object: unknown } };
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") await onCheckoutPaid(event.data.object as CheckoutSession);
    if (event.type === "account.updated") await onAccountUpdated(event.data.object as StripeAccount);
  } catch (e) {
    console.error("[stripe webhook]", event.type, (e as Error).message);
    return new Response("Retry", { status: 500 });
  }
  return Response.json({ received: true });
}
