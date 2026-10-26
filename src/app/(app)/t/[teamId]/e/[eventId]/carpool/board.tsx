"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car } from "lucide-react";
import { carpoolAction, offerRideAction, type FormState } from "@/app/actions";
import type { CarpoolView } from "@/lib/data/carpool";
import { Avatar, Button, Field, Input, buttonClass, inputClass } from "@/components/ui";

export function CarpoolBoard({ teamId, eventId, view, closed }: { teamId: string; eventId: string; view: CarpoolView; closed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [offering, setOffering] = useState(false);
  const act = (op: Parameters<typeof carpoolAction>[2], ok: string) =>
    start(async () => {
      const r = await carpoolAction(teamId, eventId, op);
      setMsg(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: r.error });
      router.refresh();
    });
  const myOffer = view.offers.find((o) => o.id === view.myOfferId);

  return (
    <div className="grid gap-4">
      <ul className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Carpool so far">
        <li className="rounded-pill bg-team-soft px-3 py-1.5 text-team-ink tabular">
          {view.totals.cars} {view.totals.cars === 1 ? "car" : "cars"} · {view.totals.free} {view.totals.free === 1 ? "seat" : "seats"} free
        </li>
        {view.totals.waiting > 0 && <li className="rounded-pill bg-warning-soft px-3 py-1.5 text-warning tabular">{view.totals.waiting} still need a lift</li>}
      </ul>

      {msg && (
        <p role={msg.tone === "error" ? "alert" : "status"} className={`text-sm font-medium ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
          {msg.text}
        </p>
      )}

      {view.offers.length === 0 && <p className="text-sm text-muted">No one has offered a lift yet.</p>}
      <ul className="grid gap-3">
        {view.offers.map((o) => {
          const mineHere = view.myRequest?.offerId === o.id;
          const driving = o.id === view.myOfferId;
          return (
            <li key={o.id} className={`grid gap-2.5 rounded-lg border p-3.5 ${o.free === 0 && !mineHere && !driving ? "border-transparent bg-surface" : "border-border"}`}>
              <div className="flex items-center gap-3">
                <Avatar name={`${o.driver.firstName} ${o.driver.lastName}`} src={o.driver.photo} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {o.driver.firstName} {o.driver.lastName}
                    {driving && <span className="font-normal text-muted"> (you)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    Leaves {o.leavesAt} · {o.from}
                  </p>
                </div>
                <span className="flex gap-1" aria-label={`${o.seats - o.free} of ${o.seats} seats taken`}>
                  {Array.from({ length: o.seats }, (_, i) => (
                    <span key={i} aria-hidden className={`size-5 rounded-sm ${i < o.seats - o.free ? "bg-team" : "border-[1.5px] border-border-input"}`} />
                  ))}
                </span>
              </div>
              {o.note && <p className="text-sm">{o.note}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">{o.riders.length ? `With ${o.riders.map((r) => r.person.firstName).join(", ")}` : "No riders yet"}</span>
                {!closed &&
                  (driving ? null : mineHere ? (
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => act({ kind: "take", offerId: null }, "You're back on the waiting list.")}>
                      Leave this car
                    </Button>
                  ) : o.free === 0 ? (
                    <span className="font-semibold text-muted">This car is full</span>
                  ) : view.myOfferId ? null : (
                    <Button size="sm" disabled={pending} onClick={() => act({ kind: "take", offerId: o.id }, `You're in ${o.driver.firstName}'s car.`)}>
                      Take a seat
                    </Button>
                  ))}
              </div>
              {view.canManage && !closed && o.riders.length > 0 && (
                <div className="grid gap-1 border-t border-border pt-2">
                  {o.riders.map((r) => (
                    <div key={r.requestId} className="flex items-center justify-between gap-2 text-sm">
                      <span>{r.person.firstName} {r.person.lastName}</span>
                      <button type="button" className="min-h-8 font-semibold text-team-ink" onClick={() => act({ kind: "assign", requestId: r.requestId, offerId: null }, "Moved back to waiting.")}>
                        Take out
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {view.waiting.length > 0 && (
        <section aria-labelledby="wait-h" className="grid gap-2">
          <h3 id="wait-h" className="eyebrow">
            Need a lift
          </h3>
          <ul className="grid gap-2">
            {view.waiting.map((w) => (
              <li key={w.requestId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                <span>
                  <strong>
                    {w.person.firstName} {w.person.lastName}
                  </strong>
                  {w.person.id === view.me && " (you)"}
                  {w.from && <span className="text-muted"> · from {w.from}</span>}
                </span>
                {view.canManage && !closed && view.offers.some((o) => o.free > 0) && (
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Put {w.person.firstName} in a car</span>
                    <select
                      className={`${inputClass} min-h-9 py-0 text-sm`}
                      defaultValue=""
                      onChange={(ev) => ev.target.value && act({ kind: "assign", requestId: w.requestId, offerId: ev.target.value }, `${w.person.firstName} has a seat.`)}
                    >
                      <option value="">Put in a car…</option>
                      {view.offers.filter((o) => o.free > 0).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.driver.firstName}&apos;s car ({o.free} free)
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!closed && (
        <div className="grid gap-3">
          {offering || myOffer ? (
            <OfferForm teamId={teamId} eventId={eventId} initial={myOffer} onCancelOffer={myOffer ? () => act({ kind: "cancelOffer" }, "Your car is off. Riders are back on the waiting list and got an email.") : undefined} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setOffering(true)}>
                <Car aria-hidden />
                I&apos;m driving
              </Button>
              {!view.myRequest ? (
                <Button variant="secondary" disabled={pending} onClick={() => act({ kind: "take", offerId: null }, "You're on the list. Drivers can see you need a lift.")}>
                  I need a lift
                </Button>
              ) : (
                <Button variant="ghost" disabled={pending} onClick={() => act({ kind: "leave" }, "Sorted. You're off the carpool.")}>
                  I&apos;ve got my own way there
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OfferForm({ teamId, eventId, initial, onCancelOffer }: { teamId: string; eventId: string; initial?: { seats: number; leavesAt: string; from: string; note: string | null }; onCancelOffer?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(offerRideAction.bind(null, teamId, eventId), null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-border p-4" noValidate>
      <h3 className="font-semibold">{initial ? "Your car" : "Offer a lift"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field id="seats" label="Free seats" error={fe.seats}>
          <Input id="seats" name="seats" type="number" min={1} max={8} defaultValue={initial?.seats ?? 3} error={fe.seats} />
        </Field>
        <Field id="leavesAt" label="Leaving at" error={fe.leavesAt}>
          <Input id="leavesAt" name="leavesAt" type="time" defaultValue={initial?.leavesAt ?? "11:30"} error={fe.leavesAt} />
        </Field>
      </div>
      <Field id="from" label="Leaving from" error={fe.from} hint="A place, not your home address">
        <Input id="from" name="from" maxLength={80} defaultValue={initial?.from} placeholder="e.g. Club car park" error={fe.from} />
      </Field>
      <Field id="note" label="Note (optional)">
        <Input id="note" name="note" maxLength={120} defaultValue={initial?.note ?? ""} />
      </Field>
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm font-medium text-success">{state.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass("primary")} disabled={pending}>
          {initial ? "Save" : "Offer seats"}
        </button>
        {onCancelOffer && (
          <Button variant="ghost" onClick={onCancelOffer}>
            I can&apos;t drive any more
          </Button>
        )}
      </div>
    </form>
  );
}
