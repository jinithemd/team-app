import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "../mode";

/*
 * Where payout accounts and the online payments ledger live. Sample build: memory (gone on
 * restart). Live: Supabase through the server key; the service checks who may do what first.
 */

export interface PayoutAccount {
  id: string;
  userId: string;
  stripeAccountId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  needsInfo: boolean;
}

export type PayKind = "dues" | "event" | "tournament" | "session";
export type PayStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export interface OnlinePayment {
  id: string;
  kind: PayKind;
  refId: string;
  teamId: string | null;
  tournamentId: string | null;
  payerId: string | null;
  forUserId: string | null;
  payoutAccountId: string | null;
  method: "card" | "cash";
  amountCents: number;
  feeCents: number;
  totalCents: number;
  status: PayStatus;
  label: string | null;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  recordedBy: string | null;
  paidAt: string | null;
  createdAt: string;
}

export const accountReady = (a: PayoutAccount | null | undefined) => !!a && a.detailsSubmitted && a.transfersEnabled;

// ---------------------------------------------------------------------------
// sample build
// ---------------------------------------------------------------------------

interface Mem {
  accounts: PayoutAccount[];
  payments: OnlinePayment[];
  teamCollector: Map<string, string>;
  tournamentCollector: Map<string, string>;
}
const g = globalThis as unknown as { __clbxPay?: Mem };
const mem: Mem = (g.__clbxPay ??= { accounts: [], payments: [], teamCollector: new Map(), tournamentCollector: new Map() } as Mem);

// ---------------------------------------------------------------------------
// live build
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
async function admin(): Promise<SupabaseClient> {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as SupabaseClient;
}
const s = (v: unknown) => (v == null ? null : String(v));
const toA = (r: Row): PayoutAccount => ({
  id: s(r.id)!, userId: s(r.user_id)!, stripeAccountId: s(r.stripe_account_id), detailsSubmitted: !!r.details_submitted,
  payoutsEnabled: !!r.payouts_enabled, transfersEnabled: !!r.transfers_enabled, needsInfo: !!r.needs_info,
});
const fromA = (a: Partial<PayoutAccount>): Row => {
  const map: Record<string, string> = { userId: "user_id", stripeAccountId: "stripe_account_id", detailsSubmitted: "details_submitted", payoutsEnabled: "payouts_enabled", transfersEnabled: "transfers_enabled", needsInfo: "needs_info" };
  const out: Row = {};
  for (const [k, v] of Object.entries(a)) if (map[k]) out[map[k]] = v;
  return out;
};
const toP = (r: Row): OnlinePayment => ({
  id: s(r.id)!, kind: r.kind as PayKind, refId: s(r.ref_id)!, teamId: s(r.team_id), tournamentId: s(r.tournament_id), payerId: s(r.payer_id), forUserId: s(r.for_user_id),
  payoutAccountId: s(r.payout_account_id), method: (r.method as "card" | "cash") ?? "card", amountCents: Number(r.amount_cents), feeCents: Number(r.fee_cents), totalCents: Number(r.total_cents),
  status: r.status as PayStatus, label: s(r.label), stripeSessionId: s(r.stripe_session_id), stripePaymentIntent: s(r.stripe_payment_intent), recordedBy: s(r.recorded_by), paidAt: s(r.paid_at), createdAt: s(r.created_at)!,
});
const fromP = (p: Partial<OnlinePayment>): Row => {
  const map: Record<string, string> = {
    id: "id", kind: "kind", refId: "ref_id", teamId: "team_id", tournamentId: "tournament_id", payerId: "payer_id", forUserId: "for_user_id", payoutAccountId: "payout_account_id",
    method: "method", amountCents: "amount_cents", feeCents: "fee_cents", totalCents: "total_cents", status: "status", label: "label", stripeSessionId: "stripe_session_id",
    stripePaymentIntent: "stripe_payment_intent", recordedBy: "recorded_by", paidAt: "paid_at",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) if (map[k]) out[map[k]] = v;
  return out;
};
function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[payments] ${what}: ${error.message}`);
    throw new Error("Couldn't save the payment details. Try again.");
  }
}

// ---------------------------------------------------------------------------
// the store
// ---------------------------------------------------------------------------

export async function accountByUser(userId: string): Promise<PayoutAccount | null> {
  if (!LIVE) return mem.accounts.find((a) => a.userId === userId) ?? null;
  const { data } = await (await admin()).from("payout_accounts").select("*").eq("user_id", userId).maybeSingle();
  return data ? toA(data) : null;
}
export async function accountById(id: string | null): Promise<PayoutAccount | null> {
  if (!id) return null;
  if (!LIVE) return mem.accounts.find((a) => a.id === id) ?? null;
  const { data } = await (await admin()).from("payout_accounts").select("*").eq("id", id).maybeSingle();
  return data ? toA(data) : null;
}
export async function accountByStripe(stripeId: string): Promise<PayoutAccount | null> {
  if (!LIVE) return mem.accounts.find((a) => a.stripeAccountId === stripeId) ?? null;
  const { data } = await (await admin()).from("payout_accounts").select("*").eq("stripe_account_id", stripeId).maybeSingle();
  return data ? toA(data) : null;
}
export async function saveAccount(userId: string, patch: Partial<PayoutAccount>): Promise<PayoutAccount> {
  if (!LIVE) {
    let a = mem.accounts.find((x) => x.userId === userId);
    if (!a) mem.accounts.push((a = { id: randomUUID(), userId, stripeAccountId: null, detailsSubmitted: false, payoutsEnabled: false, transfersEnabled: false, needsInfo: false }));
    Object.assign(a, patch);
    return a;
  }
  const sb = await admin();
  const { data, error } = await sb.from("payout_accounts").upsert({ ...fromA(patch), user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("*").single();
  check(error, "save account");
  return toA(data!);
}

export async function collector(scope: "team" | "tournament", id: string): Promise<string | null> {
  if (!LIVE) return (scope === "team" ? mem.teamCollector : mem.tournamentCollector).get(id) ?? null;
  const { data } = await (await admin()).from(scope === "team" ? "teams" : "tournaments").select("payout_account_id").eq("id", id).maybeSingle();
  return s((data as Row | null)?.payout_account_id);
}
export async function setCollector(scope: "team" | "tournament", id: string, accountId: string | null) {
  if (!LIVE) {
    const m = scope === "team" ? mem.teamCollector : mem.tournamentCollector;
    if (accountId) m.set(id, accountId);
    else m.delete(id);
    return;
  }
  const { error } = await (await admin()).from(scope === "team" ? "teams" : "tournaments").update({ payout_account_id: accountId }).eq("id", id);
  check(error, "set collector");
}

export async function insertPayment(p: Omit<OnlinePayment, "id" | "createdAt"> & { id?: string }): Promise<OnlinePayment> {
  const row: OnlinePayment = { ...p, id: p.id ?? randomUUID(), createdAt: new Date().toISOString() };
  if (!LIVE) {
    mem.payments.push(row);
    return row;
  }
  const { data, error } = await (await admin()).from("online_payments").insert(fromP(row)).select("*").single();
  check(error, "insert payment");
  return toP(data!);
}
export async function updatePayment(id: string, patch: Partial<OnlinePayment>, onlyIfStatus?: PayStatus): Promise<OnlinePayment | null> {
  if (!LIVE) {
    const p = mem.payments.find((x) => x.id === id);
    if (!p || (onlyIfStatus && p.status !== onlyIfStatus)) return null;
    Object.assign(p, patch);
    return p;
  }
  let q = (await admin()).from("online_payments").update({ ...fromP(patch), updated_at: new Date().toISOString() }).eq("id", id);
  if (onlyIfStatus) q = q.eq("status", onlyIfStatus);
  const { data, error } = await q.select("*");
  check(error, "update payment");
  return data?.[0] ? toP(data[0]) : null;
}
export async function paymentById(id: string): Promise<OnlinePayment | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!LIVE) return mem.payments.find((x) => x.id === id) ?? null;
  const { data } = await (await admin()).from("online_payments").select("*").eq("id", id).maybeSingle();
  return data ? toP(data) : null;
}
export async function paymentsFor(kind: PayKind, refIds: string[]): Promise<OnlinePayment[]> {
  if (!refIds.length) return [];
  if (!LIVE) return mem.payments.filter((p) => p.kind === kind && refIds.includes(p.refId));
  const { data } = await (await admin()).from("online_payments").select("*").eq("kind", kind).in("ref_id", refIds);
  return (data ?? []).map(toP);
}
export async function paymentsForAccount(accountId: string): Promise<OnlinePayment[]> {
  if (!LIVE) return mem.payments.filter((p) => p.payoutAccountId === accountId && p.status === "paid" && p.method === "card");
  const { data } = await (await admin()).from("online_payments").select("*").eq("payout_account_id", accountId).eq("status", "paid").eq("method", "card").order("paid_at", { ascending: false }).limit(200);
  return (data ?? []).map(toP);
}

// ---------------------------------------------------------------------------
// what a paid payment does
// ---------------------------------------------------------------------------

/** Card dues payments land as confirmed payments on the due, like a ticked-off e-Transfer. */
export async function creditDue(dueId: string, amountCents: number, payerId: string | null, ref: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (!LIVE) {
    const { db, newId, now } = await import("../data/store");
    db.payments.push({ id: newId(), dueId, amountCents, method: "card", ref, paidOn: today, reportedBy: payerId ?? "", verifiedBy: payerId ?? "", verifiedAt: now(), createdAt: now() });
    return;
  }
  const { error } = await (await admin()).from("payments").insert({
    due_id: dueId, amount_cents: amountCents, method: "card", paid_on: today, reference: ref.slice(0, 80),
    reported_by: payerId, verified_by: payerId, verified_at: new Date().toISOString(),
  });
  check(error, "credit due");
}

export async function markEntryPaid(entryId: string) {
  if (!LIVE) {
    const t = (globalThis as unknown as { __clbxTournaments?: { entries: { id: string; paid: boolean }[] } }).__clbxTournaments;
    const e = t?.entries.find((x) => x.id === entryId);
    if (e) e.paid = true;
    return;
  }
  const { error } = await (await admin()).from("tournament_teams").update({ paid: true }).eq("id", entryId);
  check(error, "mark entry paid");
}
