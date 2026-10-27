import "server-only";
import type { ActionResult, ID, PaymentMethod, Person } from "./types";
import { activePlayers, clubRoleFor, db, hasTeamPerm, isClubAdmin, isTeamMember, money, newId, now, personOf, profileById, queueEmail, APP_URL, requireUser, teamById } from "./store";

/*
 * Dues, tracked by hand: the treasurer sets a fee, players pay by e-Transfer or cash and
 * report it, the treasurer confirms. Players see only their own balance (like the RLS).
 * Card payments go through lib/payments and land here as confirmed payments.
 */

const METHODS: PaymentMethod[] = ["etransfer", "cash", "other"];
export const METHOD_LABEL: Record<PaymentMethod, string> = { etransfer: "e-Transfer", cash: "Cash", other: "Other", card: "Card (online)" };

function paidOn(dueId: ID, verifiedOnly: boolean) {
  return db.payments.filter((p) => p.dueId === dueId && (!verifiedOnly || p.verifiedAt)).reduce((n, p) => n + p.amountCents, 0);
}
function today() {
  return now().slice(0, 10);
}

export type DueStatus = "paid" | "reported" | "overdue" | "owes";

function dueRow(dueId: ID) {
  const d = db.dues.find((x) => x.id === dueId)!;
  const fee = db.fees.find((f) => f.id === d.feeId)!;
  const paid = paidOn(d.id, true);
  const reported = paidOn(d.id, false) - paid;
  const left = Math.max(0, d.amountCents - paid);
  const status: DueStatus = left === 0 ? "paid" : reported >= left ? "reported" : fee.dueOn && fee.dueOn < today() ? "overdue" : "owes";
  return { due: d, fee, paid, reported, left, status };
}

export async function getTeamDues(teamId: ID) {
  const user = await requireUser();
  const team = teamById(teamId);
  if (!team || !isTeamMember(user.id, teamId)) return null;
  const treasurer = hasTeamPerm(user.id, teamId, "payments");
  const fees = db.fees.filter((f) => f.teamId === teamId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dues = db.dues.filter((d) => fees.some((f) => f.id === d.feeId) && (treasurer || d.userId === user.id)).map((d) => dueRow(d.id));

  const byPlayer = new Map<ID, { person: Person; owed: number; paid: number; left: number; reported: number; status: DueStatus; dueIds: ID[] }>();
  for (const r of dues) {
    const cur = byPlayer.get(r.due.userId) ?? { person: personOf(r.due.userId), owed: 0, paid: 0, left: 0, reported: 0, status: "paid" as DueStatus, dueIds: [] };
    cur.owed += r.due.amountCents;
    cur.paid += r.paid;
    cur.left += r.left;
    cur.reported += r.reported;
    cur.dueIds.push(r.due.id);
    const rank = { overdue: 3, owes: 2, reported: 1, paid: 0 };
    if (rank[r.status] > rank[cur.status]) cur.status = r.status;
    byPlayer.set(r.due.userId, cur);
  }
  const players = [...byPlayer.values()].sort((a, b) => b.left - a.left || a.person.firstName.localeCompare(b.person.firstName));
  const toConfirm = treasurer
    ? db.payments
        .filter((p) => !p.verifiedAt && dues.some((r) => r.due.id === p.dueId))
        .map((p) => {
          const r = dues.find((x) => x.due.id === p.dueId)!;
          return { id: p.id, person: personOf(r.due.userId), amount: p.amountCents, method: p.method, ref: p.ref, paidOn: p.paidOn, fee: r.fee.name };
        })
    : [];
  const mine = dues.filter((r) => r.due.userId === user.id);
  return {
    team: { id: team.id, name: team.name, clubId: team.clubId },
    treasurer,
    payTo: team.settings.payTo ?? null,
    fees: fees.map((f) => {
      const rows = dues.filter((r) => r.fee.id === f.id);
      return { ...f, players: rows.length, collected: rows.reduce((n, r) => n + r.paid, 0), total: rows.reduce((n, r) => n + r.due.amountCents, 0) };
    }),
    totals: {
      collected: dues.reduce((n, r) => n + r.paid, 0),
      total: dues.reduce((n, r) => n + r.due.amountCents, 0),
      left: dues.reduce((n, r) => n + r.left, 0),
      owing: players.filter((p) => p.left > 0).length,
    },
    players,
    toConfirm,
    mine: mine.map((r) => ({
      dueId: r.due.id,
      fee: r.fee.name,
      amount: r.due.amountCents,
      paid: r.paid,
      reported: r.reported,
      left: r.left,
      status: r.status,
      dueOn: r.fee.dueOn,
      payments: db.payments.filter((p) => p.dueId === r.due.id).map((p) => ({ id: p.id, amount: p.amountCents, method: p.method, paidOn: p.paidOn, confirmed: !!p.verifiedAt })),
    })),
  };
}

/** What I owe across all my teams, for Home and Account. */
export async function myBalances() {
  const user = await requireUser();
  return db.dues
    .filter((d) => d.userId === user.id)
    .map((d) => ({ ...dueRow(d.id), teamId: db.fees.find((f) => f.id === d.feeId)!.teamId }))
    .filter((r) => r.left > 0)
    .map((r) => ({ teamId: r.teamId, teamName: teamById(r.teamId)!.name, fee: r.fee.name, left: r.left, status: r.status }));
}

export async function addFee(teamId: ID, input: { name: string; amount: string; dueOn?: string }): Promise<ActionResult<{ players: number }>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "payments")) return { ok: false, error: "Only the treasurer can add fees." };
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  const cents = Math.round(Number(input.amount.replace(/[$,\s]/g, "")) * 100);
  if (!name) fieldErrors.name = "Name the fee, like Season fee.";
  if (!Number.isFinite(cents) || cents <= 0 || cents > 1_000_000) fieldErrors.amount = "Enter an amount like 120.";
  if (input.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) fieldErrors.dueOn = "Pick a date.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const season = db.seasons.find((s) => s.teamId === teamId && !s.closedAt);
  const fee = { id: newId(), teamId, seasonId: season?.id ?? null, name, amountCents: cents, dueOn: input.dueOn || null, createdAt: now() };
  db.fees.push(fee);
  const players = activePlayers(teamId);
  players.forEach((r) => db.dues.push({ id: newId(), feeId: fee.id, userId: r.userId!, amountCents: cents }));
  return { ok: true, data: { players: players.length } };
}

/** A player reports what they paid; the treasurer recording it confirms it at the same time. */
export async function reportPayment(dueId: ID, input: { amount: string; method: string; ref?: string; paidOn?: string }): Promise<ActionResult> {
  const user = await requireUser();
  const d = db.dues.find((x) => x.id === dueId);
  if (!d) return { ok: false, error: "That fee no longer exists." };
  const fee = db.fees.find((f) => f.id === d.feeId)!;
  const treasurer = hasTeamPerm(user.id, fee.teamId, "payments");
  if (d.userId !== user.id && !treasurer) return { ok: false, error: "You can only report your own payments." };
  const cents = Math.round(Number(input.amount.replace(/[$,\s]/g, "")) * 100);
  const left = d.amountCents - paidOn(d.id, false);
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(cents) || cents <= 0) fieldErrors.amount = "Enter what you paid.";
  else if (cents > left) fieldErrors.amount = `That's more than the ${money(left)} left.`;
  const method = METHODS.find((m) => m === input.method);
  if (!method) fieldErrors.method = "Pick how you paid.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  db.payments.push({
    id: newId(), dueId, amountCents: cents, method: method!, ref: input.ref?.trim() || null, paidOn: input.paidOn || today(),
    reportedBy: user.id, verifiedBy: treasurer ? user.id : null, verifiedAt: treasurer ? now() : null, createdAt: now(),
  });
  return { ok: true, data: undefined };
}

export async function confirmPayment(paymentId: ID, accept: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const p = db.payments.find((x) => x.id === paymentId);
  if (!p) return { ok: false, error: "Already sorted." };
  const d = db.dues.find((x) => x.id === p.dueId)!;
  const fee = db.fees.find((f) => f.id === d.feeId)!;
  if (!hasTeamPerm(user.id, fee.teamId, "payments")) return { ok: false, error: "Only the treasurer can confirm payments." };
  if (accept) Object.assign(p, { verifiedBy: user.id, verifiedAt: now() });
  else {
    db.payments = db.payments.filter((x) => x !== p);
    const payer = profileById(d.userId);
    if (payer)
      queueEmail({
        to: payer.email,
        subject: `${teamById(fee.teamId)!.name} · We couldn't find your ${money(p.amountCents)} payment`,
        text: `${user.firstName} couldn't match your ${METHOD_LABEL[p.method]} for ${fee.name}. Check it went through, or talk to them.`,
        links: [{ label: "See your dues", href: `${APP_URL}/t/${fee.teamId}/dues` }],
      });
  }
  return { ok: true, data: undefined };
}

export async function remindUnpaid(teamId: ID): Promise<ActionResult<{ sent: number }>> {
  const user = await requireUser();
  if (!hasTeamPerm(user.id, teamId, "payments")) return { ok: false, error: "Only the treasurer can send reminders." };
  const team = teamById(teamId)!;
  const owing = new Map<ID, number>();
  for (const d of db.dues.filter((x) => db.fees.some((f) => f.id === x.feeId && f.teamId === teamId))) {
    const r = dueRow(d.id);
    if (r.status === "owes" || r.status === "overdue") owing.set(d.userId, (owing.get(d.userId) ?? 0) + r.left);
  }
  for (const [uid, left] of owing) {
    const p = profileById(uid);
    if (!p) continue;
    queueEmail({
      to: p.email,
      subject: `${team.name} · ${money(left)} still to pay`,
      text: `Hi ${p.firstName}, you've got ${money(left)} left to pay for ${team.name}.${team.settings.payTo ? ` e-Transfer to ${team.settings.payTo}.` : ""} Tell us once it's sent so the treasurer can tick it off.`,
      links: [{ label: "I've paid", href: `${APP_URL}/t/${teamId}/dues` }],
    });
  }
  return { ok: true, data: { sent: owing.size } };
}

/** Club-wide totals for the club admin and the club treasurer. */
export async function clubDues(clubId: ID) {
  const user = await requireUser();
  const role = clubRoleFor(user.id, clubId);
  if (!role) return null;
  const teams = db.teams.filter((t) => t.clubId === clubId);
  return teams.map((t) => {
    const rows = db.dues.filter((d) => db.fees.some((f) => f.id === d.feeId && f.teamId === t.id)).map((d) => dueRow(d.id));
    return {
      teamId: t.id,
      name: t.name,
      collected: rows.reduce((n, r) => n + r.paid, 0),
      total: rows.reduce((n, r) => n + r.due.amountCents, 0),
      owing: new Set(rows.filter((r) => r.left > 0).map((r) => r.due.userId)).size,
      toConfirm: db.payments.filter((p) => !p.verifiedAt && rows.some((r) => r.due.id === p.dueId)).length,
      canOpen: isClubAdmin(user.id, clubId) || role === "treasurer",
    };
  });
}
