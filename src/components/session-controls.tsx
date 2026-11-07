"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CreditCard } from "lucide-react";
import { bookSessionAction, declineSessionAction, cancelBookingAction, cancelSessionAction, deleteSeriesAction, deleteSessionAction, payForBookingAction, seriesAction, staffBookingAction } from "@/app/session-actions";
import { buttonClass } from "./ui";
import { ConfirmButton } from "./confirm-button";

function useOp() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string; payUrl?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (r.payUrl) {
        if (/^https?:/.test(r.payUrl)) location.href = r.payUrl;
        else router.push(r.payUrl);
        return;
      }
      router.refresh();
    });
  const err = error && (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  );
  return { pending, run, err };
}

export function BookButton({ sessionId, label, waitlist, eventId, size = "lg" }: { sessionId: string; label: string; waitlist: boolean; eventId?: string; size?: "md" | "lg" }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <button type="button" disabled={pending} onClick={() => run(() => bookSessionAction(sessionId, eventId))} className={buttonClass(waitlist ? "secondary" : "primary", size, "w-full")}>
        <CalendarPlus aria-hidden />
        {pending ? "Booking…" : label}
      </button>
      {err}
    </div>
  );
}

export function PayLaterButton({ sessionId, label }: { sessionId: string; label: string }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <button type="button" disabled={pending} onClick={() => run(() => payForBookingAction(sessionId))} className={buttonClass("primary", "md", "justify-self-start")}>
        <CreditCard aria-hidden />
        {pending ? "Opening…" : label}
      </button>
      {err}
    </div>
  );
}

export function CancelBooking({ sessionId, waitlist }: { sessionId: string; waitlist: boolean }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <ConfirmButton
        disabled={pending}
        question={waitlist ? "Leave the waitlist?" : "Give up your spot? The next person on the waitlist gets it."}
        yes={waitlist ? "Leave the waitlist" : "Give up my spot"}
        no="Stay in"
        onConfirm={() => run(() => cancelBookingAction(sessionId))}
        className="justify-self-start text-sm font-semibold text-danger underline"
      >
        {waitlist ? "Leave the waitlist" : "Can't make it? Cancel my spot"}
      </ConfirmButton>
      {err}
    </div>
  );
}

export function StaffRow({ sessionId, bookingId, name, paid, priced }: { sessionId: string; bookingId: string; name: string; paid: "card" | "cash" | null; priced: boolean }) {
  const { pending, run, err } = useOp();
  return (
    <span className="grid justify-items-end gap-1">
      <span className="flex flex-wrap items-center justify-end gap-2">
        {priced &&
          (paid === "card" ? (
            <span className="rounded-pill bg-success-soft px-2 py-0.5 text-[11px] font-bold tracking-[.04em] text-success uppercase">Paid · card</span>
          ) : (
            <button
              type="button"
              disabled={pending}
              aria-pressed={paid === "cash"}
              aria-label={paid === "cash" ? `${name} paid cash. Untick` : `Mark ${name} as paid cash`}
              onClick={() => run(() => staffBookingAction(sessionId, bookingId, paid === "cash" ? "uncash" : "cash"))}
              className={`min-h-9 rounded-pill border px-3 text-xs font-bold ${paid === "cash" ? "border-success bg-success-soft text-success" : "border-border-input"}`}
            >
              {paid === "cash" ? "Paid · cash" : "Mark paid"}
            </button>
          ))}
        <ConfirmButton
          disabled={pending}
          ariaLabel={`Remove ${name}`}
          question={`Remove ${name} from this session?`}
          yes="Remove"
          no="Keep"
          onConfirm={() => run(() => staffBookingAction(sessionId, bookingId, "remove"))}
          className="min-h-9 px-2 text-xs font-semibold text-danger"
        >
          Remove
        </ConfirmButton>
      </span>
      {err}
    </span>
  );
}

export function CancelSession({ sessionId }: { sessionId: string }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <ConfirmButton
        disabled={pending}
        question="Cancel this session? Everyone booked gets an email."
        yes="Yes, cancel it"
        no="Keep it on"
        onConfirm={() => run(() => cancelSessionAction(sessionId))}
        className={buttonClass("secondary", "sm", "justify-self-start text-danger")}
      >
        Cancel session
      </ConfirmButton>
      {err}
    </div>
  );
}

export function DeleteSession({ sessionId }: { sessionId: string }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <ConfirmButton
        disabled={pending}
        question="Delete this session for good? It comes off the schedule and the bookings go with it. To keep a record, cancel it instead."
        yes="Yes, delete it"
        onConfirm={() => run(() => deleteSessionAction(sessionId))}
        className={buttonClass("ghost", "sm", "justify-self-start text-danger")}
      >
        {pending ? "Deleting…" : "Delete session"}
      </ConfirmButton>
      {err}
    </div>
  );
}

export function SeriesControls({ seriesId, active, title }: { seriesId: string; active: boolean; title?: string }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => seriesAction(seriesId, { active: !active }))} className={buttonClass("secondary", "sm")}>
          {active ? "Pause" : "Resume"}
        </button>
        <ConfirmButton
          disabled={pending}
          ariaLabel={title ? `Delete ${title}` : "Delete"}
          question={`Delete ${title ? `"${title}"` : "this weekly drop-in"}? It stops posting and its upcoming games come off the schedule. Games already played stay in your history.`}
          yes="Yes, delete it"
          onConfirm={() => run(() => deleteSeriesAction(seriesId))}
          className={buttonClass("ghost", "sm", "text-danger")}
        >
          {pending ? "Deleting…" : "Delete"}
        </ConfirmButton>
      </div>
      {err}
    </div>
  );
}

export function SkipWeek({ seriesId, date, skipped, label }: { seriesId: string; date: string; skipped: boolean; label: string }) {
  const { pending, run, err } = useOp();
  return (
    <span className="grid justify-items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-label={`${skipped ? "Bring back" : "Skip"} ${label}`}
        onClick={() => run(() => seriesAction(seriesId, { skip: date, on: !skipped }))}
        className="min-h-9 px-2 text-xs font-semibold text-team-ink underline"
      >
        {skipped ? "Bring back" : "Skip this week"}
      </button>
      {err}
    </span>
  );
}

/** On the team's event page: "Can't make it" (gives up a spot and tells the captains). */
export function DeclineButton({ sessionId, eventId, booked }: { sessionId: string; eventId: string; booked: boolean }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      {booked ? (
        <ConfirmButton
          disabled={pending}
          question="Give up your spot? The next person on the waitlist gets it."
          yes="Give up my spot"
          no="Stay in"
          onConfirm={() => run(() => declineSessionAction(sessionId, eventId))}
          className={buttonClass("secondary", "md", "w-full")}
        >
          Can&apos;t make it
        </ConfirmButton>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => declineSessionAction(sessionId, eventId))} className={buttonClass("secondary", "md", "w-full")}>
          Can&apos;t make it
        </button>
      )}
      {err}
    </div>
  );
}
