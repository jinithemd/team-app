"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CreditCard } from "lucide-react";
import { bookSessionAction, declineSessionAction, cancelBookingAction, cancelSessionAction, payForBookingAction, seriesAction, staffBookingAction } from "@/app/session-actions";
import { buttonClass } from "./ui";

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
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(waitlist ? "Leave the waitlist?" : "Give up your spot? The next person on the waitlist gets it.")) run(() => cancelBookingAction(sessionId));
        }}
        className="justify-self-start text-sm font-semibold text-danger underline"
      >
        {waitlist ? "Leave the waitlist" : "Can't make it? Cancel my spot"}
      </button>
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
        <button
          type="button"
          disabled={pending}
          aria-label={`Remove ${name}`}
          onClick={() => {
            if (confirm(`Remove ${name} from this session?`)) run(() => staffBookingAction(sessionId, bookingId, "remove"));
          }}
          className="min-h-9 px-2 text-xs font-semibold text-danger"
        >
          Remove
        </button>
      </span>
      {err}
    </span>
  );
}

export function CancelSession({ sessionId }: { sessionId: string }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Cancel this session? Everyone booked gets an email.")) run(() => cancelSessionAction(sessionId));
        }}
        className={buttonClass("secondary", "sm", "justify-self-start text-danger")}
      >
        Cancel session
      </button>
      {err}
    </div>
  );
}

export function SeriesControls({ seriesId, active }: { seriesId: string; active: boolean }) {
  const { pending, run, err } = useOp();
  return (
    <div className="grid gap-1">
      <button type="button" disabled={pending} onClick={() => run(() => seriesAction(seriesId, { active: !active }))} className={buttonClass("secondary", "sm", "justify-self-start")}>
        {active ? "Pause" : "Resume"}
      </button>
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
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!booked || confirm("Give up your spot? The next person on the waitlist gets it.")) run(() => declineSessionAction(sessionId, eventId));
        }}
        className={buttonClass("secondary", "md", "w-full")}
      >
        Can&apos;t make it
      </button>
      {err}
    </div>
  );
}
