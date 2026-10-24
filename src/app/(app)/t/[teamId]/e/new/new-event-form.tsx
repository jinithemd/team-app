"use client";

import { useActionState, useEffect, useState } from "react";
import { createEventAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";

type Kind = "game" | "practice" | "event";

function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const t = (h * 60 + m + mins + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function NewEventForm({ teamId, defaultDate, tz }: { teamId: string; defaultDate: string; tz: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createEventAction.bind(null, teamId), null);
  const fe = state?.fieldErrors ?? {};
  const [kind, setKind] = useState<Kind>("game");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:30");
  const [endTouched, setEndTouched] = useState(false);
  const [viewerTz, setViewerTz] = useState<string | null>(null);

  useEffect(() => setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  useEffect(() => {
    if (!endTouched) setEnd(addMinutes(start, kind === "practice" ? 75 : kind === "game" ? 90 : 60));
  }, [start, kind, endTouched]);

  const city = tz.split("/").pop()!.replace(/_/g, " ");
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="type" value={kind} />
      <input type="hidden" name="tz" value={tz} />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">What is it?</legend>
        <div role="radiogroup" aria-label="Event type" className="inline-flex gap-1 justify-self-start rounded-md bg-sunken p-1">
          {(["game", "practice", "event"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-9 rounded-sm px-4 text-sm font-semibold capitalize ${kind === k ? "bg-team text-on-team" : "text-muted hover:text-fg"}`}
            >
              {k === "event" ? "Other" : k}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === "game" ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field id="opponent" label="Opponent" error={fe.opponent}>
            <Input id="opponent" name="opponent" maxLength={80} placeholder="e.g. Frontenac FC" error={fe.opponent} />
          </Field>
          <fieldset className="grid content-start gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Home or away</legend>
            <div className="flex gap-1 rounded-md bg-sunken p-1">
              {(["home", "away", "neutral"] as const).map((h) => (
                <label key={h} className="relative">
                  <input type="radio" name="homeAway" value={h} defaultChecked={h === "home"} className="peer absolute inset-0 opacity-0" />
                  <span className="inline-flex min-h-9 cursor-pointer items-center rounded-sm px-3 text-sm font-semibold text-muted capitalize peer-checked:bg-team peer-checked:text-on-team peer-focus-visible:outline-2 peer-focus-visible:outline-focus">
                    {h}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <Field id="title" label={kind === "practice" ? "Name (optional)" : "Name"} error={fe.title} hint={kind === "practice" ? "Leave blank for “Practice”" : undefined}>
          <Input id="title" name="title" maxLength={80} placeholder={kind === "practice" ? "e.g. Goalkeeper session" : "e.g. Team photo day"} error={fe.title} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="date" label="Date" error={fe.date}>
          <Input id="date" name="date" type="date" defaultValue={defaultDate} error={fe.date} />
        </Field>
        <Field id="startTime" label="Starts" error={fe.startTime}>
          <Input id="startTime" name="startTime" type="time" value={start} onChange={(e) => setStart(e.target.value)} error={fe.startTime} />
        </Field>
        <Field id="endTime" label="Ends" error={fe.endTime}>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setEndTouched(true);
            }}
            error={fe.endTime}
          />
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Times are in {city} time{viewerTz && viewerTz !== tz ? ` (you're in ${viewerTz.split("/").pop()!.replace(/_/g, " ")} time)` : ""}.
      </p>

      <Field id="locationText" label="Where" hint="Families get a map link">
        <Input id="locationText" name="locationText" maxLength={120} placeholder="e.g. Invista Centre, Field 2" />
      </Field>
      <Field id="notes" label="Notes for families" hint="Optional: kit colour, arrival time, what to bring">
        <textarea id="notes" name="notes" rows={3} maxLength={1000} className={`${inputClass} py-2.5`} />
      </Field>

      <label className="flex min-h-11 items-start gap-3 rounded-md bg-surface p-3">
        <input type="checkbox" name="notify" defaultChecked className="mt-0.5 size-5 shrink-0 accent-[var(--team)]" />
        <span>
          <span className="block text-sm font-semibold">Tell the team</span>
          <span className="block text-xs text-muted">Every family gets an email with Going / Maybe / Can&apos;t make it buttons.</span>
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Adding…" : kind === "game" ? "Add game" : kind === "practice" ? "Add practice" : "Add event"}
      </button>
    </form>
  );
}
