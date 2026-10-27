import "server-only";
import { LIVE } from "../mode";
import { APP_URL } from "../data/store";
import { getAvailability, getEvent, getSessionUser, getTeam, getTeamDues, myPerms } from "../data";
import { getTournament } from "../tournaments/service";
import { priceFor } from "./pricing";
import * as stripe from "./stripe";
import {
  accountById, accountByStripe, accountByUser, accountReady, collector, creditDue, insertPayment, markEntryPaid, paymentById, paymentsFor, paymentsForAccount,
  saveAccount, setCollector, updatePayment, type OnlinePayment, type PayKind, type PayoutAccount,
} from "./store";

/*
 * Online payments, the Spond way: a person sets up a payout account once, inside Clbx
 * (Stripe's embedded form; Stripe keeps the ID, SIN and bank details). A team's treasurer
 * or a tournament host then collects into their payout account. Players pay by card, plus
 * the Clbx fee; the payout account gets exactly the amount.
 *
 * Sample build: no Stripe. Payout setup is one tap and checkout is a pretend card page.
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const paymentsOn = () => !LIVE || stripe.stripeReady();

async function me() {
  const u = await getSessionUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

function sync(a: PayoutAccount, s: stripe.StripeAccount) {
  const due = [...(s.requirements?.currently_due ?? []), ...(s.requirements?.past_due ?? [])];
  return saveAccount(a.userId, {
    detailsSubmitted: !!s.details_submitted,
    payoutsEnabled: !!s.payouts_enabled,
    transfersEnabled: s.capabilities?.transfers === "active",
    needsInfo: due.length > 0 || !!s.requirements?.disabled_reason,
  });
}

// ---------------------------------------------------------------------------
// payout accounts
// ---------------------------------------------------------------------------

export interface PayoutView {
  enabled: boolean;
  demo: boolean;
  account: PayoutAccount | null;
  ready: boolean;
  publishableKey: string | null;
  received: { count: number; cents: number };
}

/** My payout account, refreshed from Stripe so the page shows where it stands. */
export async function myPayouts(): Promise<PayoutView> {
  const u = await me();
  let a = await accountByUser(u.id);
  if (LIVE && a?.stripeAccountId && stripe.stripeReady()) {
    try {
      a = await sync(a, await stripe.getAccount(a.stripeAccountId));
    } catch {
      // Show what we last knew.
    }
  }
  const got = a ? await paymentsForAccount(a.id) : [];
  return {
    enabled: paymentsOn(),
    demo: !LIVE,
    account: a,
    ready: accountReady(a),
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    received: { count: got.length, cents: got.reduce((n, p) => n + p.amountCents, 0) },
  };
}

/** The client secret for Stripe's embedded payout form; makes the Stripe account the first time. */
export async function payoutSession(): Promise<Result<{ clientSecret: string }>> {
  if (!LIVE) return fail("Sample build: use the demo setup.");
  if (!stripe.stripeReady()) return fail("Online payments aren't switched on yet.");
  try {
    const u = await me();
    let a = await accountByUser(u.id);
    if (!a?.stripeAccountId) {
      // Stripe asks for a website; Clbx is where the payments happen.
      const acct = await stripe.createAccount({ email: u.email, firstName: u.firstName, lastName: u.lastName, url: `${APP_URL}`, userId: u.id });
      a = await saveAccount(u.id, { stripeAccountId: acct.id });
    }
    const s = await stripe.accountSession(a.stripeAccountId!);
    return { ok: true, data: { clientSecret: s.client_secret } };
  } catch (e) {
    return fail(e instanceof stripe.StripeError ? e.message : "Couldn't open the payout form. Try again.");
  }
}

/** Sample build only: pretend the payout form was filled in. */
export async function demoPayoutSetup(): Promise<Result> {
  if (LIVE) return fail("Not available.");
  const u = await me();
  await saveAccount(u.id, { stripeAccountId: `acct_demo_${u.id}`, detailsSubmitted: true, payoutsEnabled: true, transfersEnabled: true, needsInfo: false });
  return { ok: true, data: undefined };
}

/** Stripe's account.updated webhook. */
export async function onAccountUpdated(s: stripe.StripeAccount) {
  const a = await accountByStripe(s.id);
  if (a) await sync(a, s);
}

// ---------------------------------------------------------------------------
// who collects for a team or a tournament
// ---------------------------------------------------------------------------

export interface CollectorView {
  enabled: boolean;
  /** Someone is collecting and their payout account works. */
  active: boolean;
  name: string | null;
  isMe: boolean;
  canManage: boolean;
  myAccountReady: boolean;
}

async function collectorView(scope: "team" | "tournament", id: string, canManage: boolean): Promise<CollectorView> {
  const u = await getSessionUser();
  const acc = await accountById(await collector(scope, id));
  const mine = u ? await accountByUser(u.id) : null;
  let name: string | null = null;
  if (acc) {
    if (acc.userId === u?.id) name = `${u.firstName} ${u.lastName}`;
    else name = await personName(acc.userId);
  }
  return { enabled: paymentsOn(), active: accountReady(acc), name, isMe: !!acc && acc.userId === u?.id, canManage, myAccountReady: accountReady(mine) };
}

async function personName(userId: string): Promise<string | null> {
  if (!LIVE) {
    const { profileById } = await import("../data/store");
    const p = profileById(userId);
    return p ? `${p.firstName} ${p.lastName}` : null;
  }
  const { adminClient } = await import("../supabase/server");
  const { data } = await adminClient().from("profiles").select("first_name,last_name").eq("id", userId).maybeSingle();
  return data ? `${data.first_name} ${data.last_name}`.trim() : null;
}

export async function teamCollector(teamId: string): Promise<CollectorView> {
  const perms = await myPerms(teamId).catch(() => null);
  return collectorView("team", teamId, !!perms?.payments);
}

export async function tournamentCollector(tid: string): Promise<CollectorView | null> {
  const v = await getTournament(tid);
  if (!v) return null;
  return collectorView("tournament", v.t.id, v.role === "organizer");
}

/** "Collect online payments into my payout account" (or stop). */
export async function setMyCollecting(scope: "team" | "tournament", id: string, on: boolean): Promise<Result> {
  const u = await me();
  if (scope === "team") {
    const perms = await myPerms(id).catch(() => null);
    if (!perms?.payments) return fail("Only the treasurer can set up online payments.");
  } else {
    const v = await getTournament(id);
    if (!v || v.role !== "organizer") return fail("Only the tournament's organizers can set up online payments.");
  }
  if (!on) {
    await setCollector(scope, id, null);
    return { ok: true, data: undefined };
  }
  const a = await accountByUser(u.id);
  if (!accountReady(a)) return fail("Set up your payout account first.");
  await setCollector(scope, id, a!.id);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// paying
// ---------------------------------------------------------------------------

export interface PayTarget {
  kind: PayKind;
  /** dues: the due id; event: the event id; tournament: the entry id. */
  refId: string;
  /** dues and event: the team; tournament: the tournament id. */
  scopeId: string;
}

interface Resolved {
  amountCents: number;
  label: string;
  teamId: string | null;
  tournamentId: string | null;
  forUserId: string | null;
  collectorScope: "team" | "tournament";
  collectorId: string;
  back: string;
}

async function resolve(t: PayTarget, uid: string): Promise<Resolved | string> {
  if (t.kind === "dues") {
    const d = await getTeamDues(t.scopeId);
    const due = d?.mine.find((x) => x.dueId === t.refId);
    if (!d || !due) return "That fee isn't yours to pay.";
    const left = due.left - due.reported;
    if (left <= 0) return "Nothing left to pay on that.";
    return { amountCents: left, label: `${d.team.name} · ${due.fee}`, teamId: d.team.id, tournamentId: null, forUserId: uid, collectorScope: "team", collectorId: d.team.id, back: `/t/${d.team.id}/dues` };
  }
  if (t.kind === "event") {
    const e = await getEvent(t.refId);
    if (!e || e.teamId !== t.scopeId) return "That event isn't on your team.";
    if (!e.feeCents) return "This event is free.";
    const paid = (await paymentsFor("event", [e.id])).some((p) => p.forUserId === uid && p.status === "paid");
    if (paid) return "You've already paid for this one.";
    const team = await getTeam(e.teamId);
    const when = new Date(e.startAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: e.tz });
    const what = e.title || (e.opponent ? `vs ${e.opponent}` : e.type[0].toUpperCase() + e.type.slice(1));
    return { amountCents: e.feeCents, label: `${team?.name ?? "Team"} · ${what} (${when})`, teamId: e.teamId, tournamentId: null, forUserId: uid, collectorScope: "team", collectorId: e.teamId, back: `/t/${e.teamId}/e/${e.id}` };
  }
  const v = await getTournament(t.scopeId);
  const entry = v?.entries.find((x) => x.id === t.refId);
  if (!v || !entry) return "That team isn't in this tournament.";
  if (!entry.mine) return "Only that team's staff can pay its entry fee.";
  if (entry.paid) return "The entry fee is already paid.";
  if (!v.t.feeCents) return "This tournament has no entry fee.";
  return { amountCents: v.t.feeCents, label: `${v.t.name} · Entry fee for ${entry.name}`, teamId: entry.teamId, tournamentId: v.t.id, forUserId: null, collectorScope: "tournament", collectorId: v.t.id, back: `/tournaments/${v.t.id}` };
}

/** What a player would pay, for the Pay button. */
export async function quote(amountCents: number) {
  return priceFor(amountCents);
}

/** Starts a card payment. Returns where to send the player (Stripe Checkout, or the sample page). */
export async function startCheckout(t: PayTarget): Promise<Result<{ url: string }>> {
  try {
    if (!paymentsOn()) return fail("Online payments aren't switched on yet.");
    const u = await me();
    const r = await resolve(t, u.id);
    if (typeof r === "string") return fail(r);
    const acc = await accountById(await collector(r.collectorScope, r.collectorId));
    if (!accountReady(acc)) return fail(r.collectorScope === "team" ? "Your team isn't taking online payments yet. Ask your treasurer." : "The host isn't taking online payments yet.");
    const price = priceFor(r.amountCents);
    const p = await insertPayment({
      kind: t.kind, refId: t.refId, teamId: r.teamId, tournamentId: r.tournamentId, payerId: u.id, forUserId: r.forUserId, payoutAccountId: acc!.id,
      method: "card", amountCents: price.amount, feeCents: price.fee, totalCents: price.total, status: "pending", label: r.label,
      stripeSessionId: null, stripePaymentIntent: null, recordedBy: null, paidAt: null,
    });
    if (!LIVE) return { ok: true, data: { url: `/pay/${p.id}` } };
    const back = `${APP_URL}${r.back}`;
    const session = await stripe.createCheckout({
      paymentId: p.id, destination: acc!.stripeAccountId!, amountCents: price.amount, feeCents: price.fee, label: r.label, email: u.email,
      successUrl: `${APP_URL}/pay/${p.id}?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${back}${back.includes("?") ? "&" : "?"}payment=cancelled`,
    });
    await updatePayment(p.id, { stripeSessionId: session.id });
    if (!session.url) return fail("Stripe didn't open a payment page. Try again.");
    return { ok: true, data: { url: session.url } };
  } catch (e) {
    console.error("[payments] checkout:", (e as Error).message);
    return fail(e instanceof stripe.StripeError ? e.message : "Couldn't start the payment. Try again.");
  }
}

/** Marks a payment paid (once) and applies it: dues ticked off, entry marked paid. */
async function settle(p: OnlinePayment, intent: string | null) {
  const done = await updatePayment(p.id, { status: "paid", paidAt: new Date().toISOString(), stripePaymentIntent: intent }, "pending");
  if (!done) return; // already settled
  if (p.kind === "dues") await creditDue(p.refId, p.amountCents, p.payerId, intent ?? "Card");
  if (p.kind === "tournament") await markEntryPaid(p.refId);
}

/** Stripe's checkout.session.completed / async_payment_succeeded webhooks. */
export async function onCheckoutPaid(s: stripe.CheckoutSession) {
  const id = s.metadata?.clbx_payment;
  if (!id || s.payment_status !== "paid") return;
  const p = await paymentById(id);
  if (p && p.status === "pending") await settle(p, s.payment_intent);
}

export interface ReceiptView {
  payment: OnlinePayment;
  back: string;
  demo: boolean;
}

/** The page players land on after paying (and the sample build's pretend card page). */
export async function receipt(paymentId: string, sessionId?: string): Promise<ReceiptView | null> {
  const u = await getSessionUser();
  let p = await paymentById(paymentId);
  if (!p || !u || p.payerId !== u.id) return null;
  if (LIVE && p.status === "pending" && sessionId && sessionId === p.stripeSessionId) {
    // Don't wait for the webhook: ask Stripe now.
    try {
      const s = await stripe.getCheckout(sessionId);
      if (s.payment_status === "paid") {
        await settle(p, s.payment_intent);
        p = (await paymentById(p.id))!;
      }
    } catch {
      // The webhook will catch up.
    }
  }
  const back = p.kind === "tournament" ? `/tournaments/${p.tournamentId}` : p.kind === "event" ? `/t/${p.teamId}/e/${p.refId}` : `/t/${p.teamId}/dues`;
  return { payment: p, back, demo: !LIVE };
}

/** Sample build: the pretend card page's Pay button. */
export async function demoPay(paymentId: string): Promise<Result> {
  if (LIVE) return fail("Not available.");
  const u = await me();
  const p = await paymentById(paymentId);
  if (!p || p.payerId !== u.id) return fail("That payment isn't yours.");
  if (p.status !== "pending") return { ok: true, data: undefined };
  await settle(p, `pi_demo_${p.id.slice(0, 8)}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// event fees: who's paid
// ---------------------------------------------------------------------------

export interface EventPayView {
  fee: number;
  price: ReturnType<typeof priceFor>;
  collecting: boolean;
  iPaid: boolean;
  staff: boolean;
  /** Staff only: everyone going (or paid), paid or not. */
  rows: { userId: string; name: string; going: boolean; paid: "card" | "cash" | null }[];
}

export async function eventPayments(eventId: string): Promise<EventPayView | null> {
  const e = await getEvent(eventId);
  if (!e || !e.feeCents) return null;
  const u = await me();
  const [perms, pays, acc] = await Promise.all([myPerms(e.teamId), paymentsFor("event", [e.id]), accountById(await collector("team", e.teamId))]);
  const paid = new Map(pays.filter((p) => p.status === "paid" && p.forUserId).map((p) => [p.forUserId!, p.method]));
  let rows: EventPayView["rows"] = [];
  if (perms.payments || perms.staff) {
    const av = await getAvailability(e.id);
    rows = (av?.rows ?? [])
      .filter((r) => r.response === "going" || paid.has(r.person.id))
      .map((r) => ({ userId: r.person.id, name: `${r.person.firstName} ${r.person.lastName}`.trim(), going: r.response === "going", paid: paid.get(r.person.id) ?? null }));
  }
  return { fee: e.feeCents, price: priceFor(e.feeCents), collecting: paymentsOn() && accountReady(acc), iPaid: paid.has(u.id), staff: perms.payments || perms.staff, rows };
}

/** Staff tick off a player who paid cash for an event (or untick it). */
export async function recordEventCash(eventId: string, userId: string, paid: boolean): Promise<Result> {
  const e = await getEvent(eventId);
  if (!e || !e.feeCents) return fail("That event has no fee.");
  const perms = await myPerms(e.teamId);
  if (!perms.payments && !perms.staff) return fail("Only team staff can record payments.");
  const u = await me();
  const pays = (await paymentsFor("event", [e.id])).filter((p) => p.forUserId === userId && p.status === "paid");
  if (paid) {
    if (pays.length) return { ok: true, data: undefined };
    await insertPayment({
      kind: "event", refId: e.id, teamId: e.teamId, tournamentId: null, payerId: null, forUserId: userId, payoutAccountId: null, method: "cash",
      amountCents: e.feeCents, feeCents: 0, totalCents: e.feeCents, status: "paid", label: "Cash", stripeSessionId: null, stripePaymentIntent: null, recordedBy: u.id, paidAt: new Date().toISOString(),
    });
    return { ok: true, data: undefined };
  }
  const cash = pays.find((p) => p.method === "cash");
  if (!cash) return fail(pays.length ? "They paid by card, so it can't be unticked here." : "Already unticked.");
  await updatePayment(cash.id, { status: "cancelled" });
  return { ok: true, data: undefined };
}

