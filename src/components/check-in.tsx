"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, MapPin } from "lucide-react";
import { checkInAction } from "@/app/actions";
import { formatTime } from "@/lib/time";

type Mine = { status: string; minutesLate: number | null; method: string; checkedInAt: string | null; distanceM: number | null } | null;

/**
 * "I'm here": one location fix when the player taps, sent to the server, which works out the
 * distance to the venue pin. Nothing is tracked before or after; only the distance is kept.
 */
export function CheckInCard({
  eventId,
  tz,
  venue,
  state,
  opensAt,
  lateAfter,
  mine,
}: {
  eventId: string;
  tz: string;
  venue: { name: string; pinned: boolean; radiusM: number } | null;
  state: "not_yet" | "open" | "closed";
  opensAt: string;
  lateAfter: string;
  mine: Mine;
}) {
  const [done, setDone] = useState<Mine>(mine);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();

  if (done)
    return (
      <section aria-labelledby="ci-h" className="flex items-start gap-3 rounded-lg bg-success-soft p-4">
        <CheckCircle2 aria-hidden className="mt-0.5 size-6 shrink-0 text-success" />
        <div>
          <h2 id="ci-h" className="font-semibold">
            {done.method === "geo" ? "You're checked in" : "Your captain has marked you"}
          </h2>
          <p className="text-sm">
            {done.status === "late" ? `Late${done.minutesLate ? `, ${done.minutesLate} min` : ""}` : done.status === "present" ? "Present" : done.status === "excused" ? "Excused" : "Absent"}
            {done.method === "geo" && done.checkedInAt ? ` · ${formatTime(done.checkedInAt, tz)}` : ""}
            {done.method === "geo" && done.distanceM != null ? ` · ${done.distanceM} m from the pitch` : ""}
          </p>
        </div>
      </section>
    );
  if (!venue?.pinned || state === "closed") return null;

  function go() {
    setMsg(null);
    if (!("geolocation" in navigator)) return setMsg({ tone: "error", text: "This browser can't share its location. Ask your captain to mark you." });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        start(async () => {
          const res = await checkInAction(eventId, p.coords.latitude, p.coords.longitude, p.coords.accuracy);
          if (res.ok) setDone({ status: res.data.status, minutesLate: res.data.minutesLate, method: "geo", checkedInAt: new Date().toISOString(), distanceM: res.data.distanceM });
          else setMsg({ tone: "error", text: res.error });
        });
      },
      (err) => {
        setLocating(false);
        setMsg({
          tone: "error",
          text: err.code === err.PERMISSION_DENIED ? "Location is blocked for this site. Allow it in your browser settings, or ask your captain to mark you." : "Couldn't get your location. Step outside and try again, or ask your captain.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  const busy = locating || pending;
  return (
    <section aria-labelledby="ci-h" className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <MapPin aria-hidden className="mt-0.5 size-6 shrink-0 text-team-ink" />
        <div>
          <h2 id="ci-h" className="font-semibold">
            Check in at {venue.name}
          </h2>
          <p className="text-sm text-muted">
            {state === "not_yet" ? `Opens at ${formatTime(opensAt, tz)}.` : `On time until ${formatTime(lateAfter, tz)}, then it counts as late.`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={go}
        disabled={state !== "open" || busy}
        aria-busy={busy}
        className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-success text-lg font-bold text-on-success disabled:opacity-50"
      >
        {busy ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <MapPin aria-hidden className="size-5" />}
        {locating ? "Finding you…" : pending ? "Checking…" : "I'm here"}
      </button>
      <p role="status" aria-live="polite" className={`text-sm ${msg?.tone === "error" ? "font-medium text-danger" : "text-muted"}`}>
        {msg?.text ?? `We check your location once, when you tap. We keep how far you were from the pitch (within ${venue.radiusM} m counts), not where you were.`}
      </p>
    </section>
  );
}
