import type { Metadata } from "next";
import Link from "next/link";
import { getTeamDues } from "@/lib/data";
import { Banner, EmptyState } from "@/components/ui";
import { Wallet } from "lucide-react";
import { AddFee, ConfirmRow, Remind, ReportPayment } from "./dues-forms";

export const metadata: Metadata = { title: "Dues" };

const money = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const STATUS = {
  paid: ["bg-success-soft text-success", "Paid"],
  reported: ["bg-warning-soft text-warning", "Reported"],
  overdue: ["bg-danger-soft text-danger", "Overdue"],
  owes: ["bg-sunken text-muted", "Owes"],
} as const;

export default async function DuesPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ show?: string }> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const d = await getTeamDues(teamId);
  if (!d) return null;

  if (!d.treasurer)
    return (
      <div className="grid gap-5">
        <div>
          <h2 className="text-xl font-bold">Your dues</h2>
          <p className="text-sm text-muted">Only you and the treasurer see this.</p>
        </div>
        {d.mine.length === 0 ? (
          <EmptyState icon={<Wallet />} title="Nothing to pay" hint="If the team adds a fee, it shows up here." />
        ) : (
          d.mine.map((m) => (
            <section key={m.dueId} aria-label={m.fee} className="grid gap-3 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{m.fee}</p>
                  <p className="text-sm text-muted">
                    {money(m.amount)}
                    {m.dueOn ? ` · due ${new Date(m.dueOn + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : ""}
                  </p>
                </div>
                <span className={`rounded-pill px-2 py-0.5 text-[11px] font-bold tracking-[.04em] uppercase ${STATUS[m.status][0]}`}>{STATUS[m.status][1]}</span>
              </div>
              <p className="text-sm">
                <strong className="tabular">{money(m.left)}</strong> left to pay
                {m.reported > 0 && <span className="text-muted"> · {money(m.reported)} waiting for the treasurer to confirm</span>}
              </p>
              {m.payments.length > 0 && (
                <ul className="grid gap-1 text-sm text-muted">
                  {m.payments.map((p) => (
                    <li key={p.id}>
                      {money(p.amount)} on {day(p.paidOn)} · {p.confirmed ? "confirmed" : "waiting to be confirmed"}
                    </li>
                  ))}
                </ul>
              )}
              {m.left - m.reported > 0 && (
                <>
                  {d.payTo && (
                    <Banner>
                      e-Transfer to <strong className="break-all">{d.payTo}</strong>, then tell us below.
                    </Banner>
                  )}
                  <ReportPayment teamId={teamId} dueId={m.dueId} left={(m.left - m.reported) / 100} />
                </>
              )}
            </section>
          ))
        )}
      </div>
    );

  const show = sp.show === "paid" ? "paid" : sp.show === "all" ? "all" : "owes";
  const rows = d.players.filter((p) => (show === "all" ? true : show === "paid" ? p.left === 0 : p.left > 0));
  const toRemind = d.players.filter((p) => p.status === "owes" || p.status === "overdue").length;
  const pct = d.totals.total ? Math.round((d.totals.collected / d.totals.total) * 100) : 0;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Dues</h2>
        <a href={`/t/${teamId}/export/dues.csv`} className="text-sm font-semibold text-team-ink">
          Export to a spreadsheet
        </a>
      </div>
      {d.fees.length === 0 ? (
        <EmptyState icon={<Wallet />} title="No fees yet" hint="Add a season fee and every player gets their balance." />
      ) : (
        <section aria-label="Collected so far" className="grid gap-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl leading-none font-bold tabular">{money(d.totals.collected)}</p>
              <p className="text-xs text-muted">of {money(d.totals.total)} collected</p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl leading-none font-bold text-danger tabular">{money(d.totals.left)}</p>
              <p className="text-xs text-muted">owed by {d.totals.owing} {d.totals.owing === 1 ? "player" : "players"}</p>
            </div>
          </div>
          <div className="h-2.5 overflow-hidden rounded-pill bg-sunken" role="img" aria-label={`${pct} percent collected`}>
            <div className="h-full bg-team" style={{ width: `${pct}%` }} />
          </div>
          <ul className="text-sm text-muted">
            {d.fees.map((f) => (
              <li key={f.id}>
                {f.name}: {money(f.amountCents)} each · {money(f.collected)} of {money(f.total)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.toConfirm.length > 0 && (
        <section aria-labelledby="confirm-h" className="grid gap-2 rounded-lg bg-warning-soft p-3.5">
          <h3 id="confirm-h" className="eyebrow">
            {d.toConfirm.length} {d.toConfirm.length === 1 ? "payment" : "payments"} to confirm
          </h3>
          {d.toConfirm.map((p) => (
            <ConfirmRow key={p.id} teamId={teamId} paymentId={p.id} label={`${p.person.firstName} ${p.person.lastName} · ${money(p.amount)} ${p.method === "etransfer" ? "e-Transfer" : p.method}`} sub={`${p.fee} · paid ${day(p.paidOn)}${p.ref ? ` · ref ${p.ref}` : ""}`} />
          ))}
        </section>
      )}

      {d.players.length > 0 && (
        <section aria-labelledby="players-h" className="grid gap-2">
          <h3 id="players-h" className="sr-only">
            Players
          </h3>
          <nav aria-label="Filter" className="flex gap-2">
            {(
              [
                ["owes", `Owes · ${d.players.filter((p) => p.left > 0).length}`],
                ["paid", `Paid · ${d.players.filter((p) => p.left === 0).length}`],
                ["all", "All"],
              ] as const
            ).map(([k, label]) => (
              <Link
                key={k}
                href={k === "owes" ? `/t/${teamId}/dues` : `/t/${teamId}/dues?show=${k}`}
                aria-current={show === k ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-pill border px-3 text-sm font-semibold ${show === k ? "border-fg bg-fg text-bg" : "border-border-input"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <ul>
            {rows.map((p) => (
              <li key={p.person.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {p.person.firstName} {p.person.lastName}
                  </span>
                  <span className="block text-xs text-muted">{p.paid ? `Paid ${money(p.paid)}` : "Nothing yet"}</span>
                </span>
                <span className="text-right">
                  <span className={`block font-semibold tabular ${p.left ? "text-danger" : "text-success"}`}>{p.left ? money(p.left) : "Paid"}</span>
                  {p.left > 0 && (
                    <span className={`inline-block rounded-pill px-2 py-0.5 text-[10px] font-bold tracking-[.04em] uppercase ${STATUS[p.status][0]}`}>{STATUS[p.status][1]}</span>
                  )}
                </span>
              </li>
            ))}
            {rows.length === 0 && <li className="py-3 text-sm text-muted">Nobody here.</li>}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <AddFee teamId={teamId} />
        {toRemind > 0 && <Remind teamId={teamId} count={toRemind} />}
      </div>
      <p className="text-xs text-muted">Players only see their own balance. Payments are e-Transfer or cash, tracked by hand; no cards in this version.</p>
    </div>
  );
}
