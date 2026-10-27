/*
 * Clbx pricing for online payments: the player pays the amount plus 3.2% + 90¢, and the
 * team (or tournament host) receives exactly the amount. Stripe's own fee (2.9% + 30¢ for
 * Canadian cards) comes out of the Clbx part. Spond charges 3.29% + $1.00.
 */
export const FEE_PERCENT = 3.2;
export const FEE_FIXED_CENTS = 90;
export const CURRENCY = "cad";

export function clbxFee(amountCents: number) {
  return Math.round((amountCents * FEE_PERCENT) / 100) + FEE_FIXED_CENTS;
}

export function priceFor(amountCents: number) {
  const fee = clbxFee(amountCents);
  return { amount: amountCents, fee, total: amountCents + fee };
}

export const cad = (cents: number) => `$${(cents / 100).toFixed(2)}`;
