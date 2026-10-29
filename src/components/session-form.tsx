"use client";

import { useActionState, useState } from "react";
import { createSessionAction } from "@/app/session-actions";
import type { FormState } from "@/app/actions";
import { Banner, Field, Input, buttonClass, inputClass } from "@/components/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** New drop-in game (part of New event): one date, or every week (posted automatically on a schedule). */
export function SessionForm({
  teamId,
  weekly: startWeekly = false,
  today,
  teamName,
  venues = [],
}: {
  teamId: string;
  weekly?: boolean;
  today: string;
  teamName: string;
  venues?: { name: string; address: string | null }[];
}) {
  const [weekly, setWeekly] = useState(startWeekly);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev: FormState, f: FormData) => createSessionAction(teamId, f.get("weekly") === "on", prev, f), null);
  const fe = state?.fieldErrors ?? {};
  const [postWhen, setPostWhen] = useState<"now" | "later">("now");
  const [held, setHeld] = useState("");
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state?.error && !Object.keys(fe).length && <Banner tone="danger">{state.error}</Banner>}
      <Field id="title" label="Name" error={fe.title} hint="Leave blank for “Drop-in game”.">
        <Input id="title" name="title" maxLength={80} placeholder="e.g. Sunday fun game, Indoor night 5-a-side" error={fe.title} />
      </Field>

      <label className="flex min-h-11 items-center gap-3 justify-self-start rounded-md border border-border px-3">
        <input type="checkbox" name="weekly" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} className="size-5 accent-[var(--team)]" />
        <span className="text-sm font-semibold">Every week</span>
        <span className="text-xs text-muted">posts itself each week</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        {weekly ? (
          <Field id="weekday" label="Every" error={fe.weekday}>
            <select id="weekday" name="weekday" defaultValue="0" className={inputClass}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field id="date" label="Date" error={fe.date}>
            <Input id="date" name="date" type="date" min={today} error={fe.date} />
          </Field>
        )}
        <Field id="startTime" label="Starts" error={fe.startTime}>
          <Input id="startTime" name="startTime" type="time" defaultValue="10:00" error={fe.startTime} />
        </Field>
        <Field id="endTime" label="Ends" error={fe.endTime}>
          <Input id="endTime" name="endTime" type="time" defaultValue="12:00" error={fe.endTime} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="venueName" label="Where" error={fe.venueName}>
          <Input id="venueName" name="venueName" maxLength={120} placeholder="e.g. Invista Centre, Field 2" list="session-venues" error={fe.venueName} />
          <datalist id="session-venues">
            {venues.map((v) => (
              <option key={v.name} value={v.name} />
            ))}
          </datalist>
        </Field>
        <Field id="venueAddress" label="Address (optional)" error={fe.venueAddress}>
          <Input id="venueAddress" name="venueAddress" maxLength={200} placeholder="1350 Gardiners Rd, Kingston" error={fe.venueAddress} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="price" label="Cost to play ($)" error={fe.price} hint="0 or blank for free.">
          <Input id="price" name="price" inputMode="decimal" placeholder="8" error={fe.price} />
        </Field>
        <Field id="capacity" label="Spots" error={fe.capacity}>
          <Input id="capacity" name="capacity" type="number" min={1} max={500} defaultValue="20" error={fe.capacity} />
        </Field>
        <Field id="memberSpots" label={`Kept for ${teamName} players`} error={fe.memberSpots} hint="The rest are open to anyone.">
          <Input id="memberSpots" name="memberSpots" type="number" min={0} max={500} placeholder="0" value={held} onChange={(e) => setHeld(e.target.value)} error={fe.memberSpots} />
        </Field>
      </div>
      {Number(held) > 0 && (
        <Field id="releaseHours" label="Open kept spots to everyone" error={fe.releaseHours} hint="Hours before the start. Leave blank to keep them for players right up to kick-off.">
          <Input id="releaseHours" name="releaseHours" type="number" min={0} max={336} placeholder="e.g. 24" error={fe.releaseHours} />
        </Field>
      )}

      <Field id="notes" label="Notes (optional)" error={fe.notes}>
        <textarea id="notes" name="notes" rows={3} maxLength={1000} placeholder="Indoor shoes only. Bring a light and a dark shirt." className={inputClass} />
      </Field>

      {weekly ? (
        <fieldset className="grid gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Post it automatically each week</legend>
          <p className="text-sm text-muted">Each week&apos;s session goes up on its own and your players and supporters get told.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="postDaysBefore" label="Days before" error={fe.postDaysBefore}>
              <Input id="postDaysBefore" name="postDaysBefore" type="number" min={0} max={27} defaultValue="6" error={fe.postDaysBefore} />
            </Field>
            <Field id="postTime" label="At" error={fe.postTime}>
              <Input id="postTime" name="postTime" type="time" defaultValue="09:00" error={fe.postTime} />
            </Field>
          </div>
        </fieldset>
      ) : (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">When should it go up?</legend>
          <div className="flex flex-wrap gap-1 justify-self-start rounded-md bg-sunken p-1">
            {(
              [
                ["now", "Post now"],
                ["later", "Schedule it"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="relative">
                <input type="radio" name="postWhen" value={v} checked={postWhen === v} onChange={() => setPostWhen(v)} className="peer absolute inset-0 opacity-0" />
                <span className="inline-flex min-h-9 cursor-pointer items-center rounded-sm px-3.5 text-sm font-semibold text-muted peer-checked:bg-team peer-checked:text-on-team peer-focus-visible:outline-2 peer-focus-visible:outline-focus">
                  {l}
                </span>
              </label>
            ))}
          </div>
          {postWhen === "later" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="postDate" label="Post on" error={fe.postDate}>
                <Input id="postDate" name="postDate" type="date" min={today} error={fe.postDate} />
              </Field>
              <Field id="postTime" label="At" error={fe.postTime}>
                <Input id="postTime" name="postTime" type="time" defaultValue="09:00" error={fe.postTime} />
              </Field>
            </div>
          )}
        </fieldset>
      )}

      <button disabled={pending} className={buttonClass("primary", "lg", "justify-self-start")}>
        {pending ? "Saving…" : weekly ? "Set up weekly drop-in" : postWhen === "now" ? "Post drop-in" : "Schedule drop-in"}
      </button>
    </form>
  );
}
