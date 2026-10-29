import Link from "next/link";
import { Check, Users } from "lucide-react";
import { sessionPage } from "@/lib/sessions/service";
import { teamCollector } from "@/lib/payments/service";
import { priceFor } from "@/lib/payments/pricing";
import { BookButton, DeclineButton, PayLaterButton } from "./session-controls";

// A drop-in on the team's own event page: answer like any event ("I'm in" / "Can't make it"),
// see spots left, and pay. With card payments on, the spot is only yours once you've paid.

const price = (c: number) => (c ? `$${(c / 100).toFixed(2).replace(/\.00$/, "")}` : "Free");
const total = (c: number) => `$${(priceFor(c).total / 100).toFixed(2)}`;

export async function SessionSpot({ sessionId, eventId, declined }: { sessionId: string; eventId: string; declined: boolean }) {
  const p = await sessionPage(sessionId);
  if (!p || p.s.status === "cancelled") return null;
  const online = p.s.priceCents > 0 && !!(await teamCollector(p.s.teamId).catch(() => null))?.active;
  const left = p.member ? p.spots.memberLeft : p.spots.openLeft;
  const mine = p.mine;
  return (
    <section aria-labelledby="spot-h" className="grid gap-3 rounded-lg border border-border border-l-4 border-l-ev-session p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="spot-h" className="text-lg font-semibold">
          Are you in?
        </h2>
        <span className="inline-flex items-center gap-1 text-sm text-muted">
          <Users aria-hidden className="size-4" />
          {left ? `${left} of ${p.s.capacity} spots left` : `Full${p.spots.waitlist ? ` · ${p.spots.waitlist} waiting` : ""}`} · {price(p.s.priceCents)}
        </span>
      </div>

      {mine?.status === "booked" ? (
        <>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
            <Check aria-hidden className="size-4" />
            You&apos;ve got a spot{mine.paid ? ` · paid${mine.paid === "card" ? " by card" : ""}` : ""}
          </p>
          {p.s.priceCents > 0 && !mine.paid && (online ? <PayLaterButton sessionId={sessionId} label={`Pay now · ${total(p.s.priceCents)}`} /> : <p className="text-sm text-muted">Bring {price(p.s.priceCents)} or e-Transfer the organiser.</p>)}
          {!p.started && <DeclineButton sessionId={sessionId} eventId={eventId} booked />}
        </>
      ) : mine?.status === "waitlist" ? (
        <>
          <p className="text-sm font-semibold text-warning">You&apos;re number {p.waitPos} on the waitlist. We&apos;ll tell you if a spot opens up.</p>
          <DeclineButton sessionId={sessionId} eventId={eventId} booked={false} />
        </>
      ) : p.canBook ? (
        <>
          {declined && <p className="text-sm text-muted">You said you can&apos;t make it. Changed your mind?</p>}
          <div className="grid grid-cols-2 gap-2">
            <BookButton
              sessionId={sessionId}
              eventId={eventId}
              size="md"
              waitlist={p.canBook === "waitlist"}
              label={p.canBook === "waitlist" ? "Join the waitlist" : online ? `I'm in · ${total(p.s.priceCents)}` : "I'm in"}
            />
            {!declined && <DeclineButton sessionId={sessionId} eventId={eventId} booked={false} />}
          </div>
          {online && p.canBook !== "waitlist" && <p className="text-xs text-muted">Your spot is confirmed once you&apos;ve paid. Unpaid spots go back to the pool after 20 minutes.</p>}
          {p.canBook === "member" && p.spots.heldLeft > 0 && <p className="text-xs text-muted">{p.spots.heldLeft} spots are kept for players like you.</p>}
        </>
      ) : (
        <p className="text-sm text-muted">{p.started ? "This one has started." : "Bookings are closed."}</p>
      )}

      {p.manage && (
        <Link href={`/s/${sessionId}`} className="justify-self-start text-sm font-semibold text-team-ink underline">
          See who&apos;s coming and who&apos;s paid
        </Link>
      )}
    </section>
  );
}
