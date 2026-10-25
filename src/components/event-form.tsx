"use client";

import { useActionState, useEffect, useState } from "react";
import { createEventAction, updateEventAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass, inputClass } from "@/components/ui";
import { EVENT_TYPE_LABEL, type EventType, type Venue } from "@/lib/data/types";
import { LocationPicker } from "@/components/location-picker";

const NEW = "__new";

function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const t = (h * 60 + m + mins + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const LENGTH: Record<EventType, number> = { match: 90, training: 75, tournament: 360, social: 180, other: 60 };

export interface EventFormInitial {
  type: EventType;
  competition: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  meetMinutes: string;
  venueId: string;
  locationText: string;
  opponent: string;
  homeAway: "home" | "away" | "neutral";
  notes: string;
  squadSize: string;
  sponsorVisible?: "auto" | "show" | "hide";
}

/**
 * New and edit event share one form. Captains without schedule_games only see
 * training, social and other; matches and tournaments need that permission.
 */
export function EventForm({
  teamId,
  tz,
  venues,
  canFixtures,
  canEvents,
  initial,
  eventId,
  inSeries,
}: {
  teamId: string;
  tz: string;
  venues: Venue[];
  canFixtures: boolean;
  canEvents: boolean;
  initial: EventFormInitial;
  eventId?: string;
  inSeries?: boolean;
}) {
  const editing = !!eventId;
  const bound = editing ? updateEventAction.bind(null, eventId!, teamId) : createEventAction.bind(null, teamId);
  const [state, action, pending] = useActionState<FormState, FormData>(bound, null);
  const fe = state?.fieldErrors ?? {};
  const types = (["match", "training", "tournament", "social", "other"] as const).filter((t) => (t === "match" || t === "tournament" ? canFixtures : canEvents));
  const [kind, setKind] = useState<EventType>(types.includes(initial.type) ? initial.type : types[0]);
  const [start, setStart] = useState(initial.startTime);
  const [end, setEnd] = useState(initial.endTime);
  const [endTouched, setEndTouched] = useState(editing);
  // No saved venue yet: start on "New place" so the map is right there.
  const [venueId, setVenueId] = useState(initial.venueId || (initial.locationText ? "" : venues.length ? venues[0].id : NEW));
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [viewerTz, setViewerTz] = useState<string | null>(null);

  useEffect(() => setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  useEffect(() => {
    if (!endTouched) setEnd(addMinutes(start, LENGTH[kind]));
  }, [start, kind, endTouched]);

  const city = tz.split("/").pop()!.replace(/_/g, " ");
  const fixture = kind === "match" || kind === "tournament";
  const label = editing ? "Save changes" : `Add ${EVENT_TYPE_LABEL[kind].toLowerCase()}`;
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="type" value={kind} />
      <input type="hidden" name="tz" value={tz} />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">What is it?</legend>
        <div role="radiogroup" aria-label="Event type" className="flex flex-wrap gap-1 justify-self-start rounded-md bg-sunken p-1">
          {types.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-9 rounded-sm px-3.5 text-sm font-semibold ${kind === k ? "bg-team text-on-team" : "text-muted hover:text-fg"}`}
            >
              {EVENT_TYPE_LABEL[k]}
            </button>
          ))}
        </div>
        {!canFixtures && <p className="text-xs text-muted">Matches and tournaments are added by your manager.</p>}
      </fieldset>

      {kind === "match" && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field id="opponent" label="Opponent" error={fe.opponent}>
            <Input id="opponent" name="opponent" maxLength={80} defaultValue={initial.opponent} placeholder="e.g. Frontenac FC" error={fe.opponent} />
          </Field>
          <fieldset className="grid content-start gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Home or away</legend>
            <div className="flex gap-1 rounded-md bg-sunken p-1">
              {(["home", "away", "neutral"] as const).map((h) => (
                <label key={h} className="relative">
                  <input type="radio" name="homeAway" value={h} defaultChecked={h === initial.homeAway} className="peer absolute inset-0 opacity-0" />
                  <span className="inline-flex min-h-9 cursor-pointer items-center rounded-sm px-3 text-sm font-semibold text-muted capitalize peer-checked:bg-team peer-checked:text-on-team peer-focus-visible:outline-2 peer-focus-visible:outline-focus">
                    {h}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      {kind !== "match" && (
        <Field
          id="title"
          label={kind === "training" ? "Name (optional)" : "Name"}
          error={fe.title}
          hint={kind === "training" ? "Leave blank for “Training”" : undefined}
        >
          <Input
            id="title"
            name="title"
            maxLength={80}
            defaultValue={initial.title}
            placeholder={kind === "training" ? "e.g. Fitness session" : kind === "tournament" ? "e.g. Limestone Cup" : "e.g. End-of-season night"}
            error={fe.title}
          />
        </Field>
      )}
      {fixture && (
        <Field id="competition" label="Competition">
          <select id="competition" name="competition" defaultValue={initial.competition || "league"} className={inputClass}>
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="friendly">Friendly</option>
          </select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="date" label="Date" error={fe.date}>
          <Input id="date" name="date" type="date" defaultValue={initial.date} error={fe.date} />
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="meetMinutes" label="Meet before the start" error={fe.meetMinutes} hint="Warm-up time, in minutes. Leave at 0 for none.">
          <Input id="meetMinutes" name="meetMinutes" type="number" min={0} max={180} step={5} defaultValue={initial.meetMinutes || "0"} error={fe.meetMinutes} />
        </Field>
        <Field id="squadSize" label="Players needed" error={fe.squadSize} hint="Optional. Shows “12 of 14” on the event.">
          <Input id="squadSize" name="squadSize" type="number" min={1} max={60} defaultValue={initial.squadSize} error={fe.squadSize} />
        </Field>
      </div>

      <Field id="venueId" label="Where" error={fe.venueId} hint={venueId === NEW ? undefined : venues.length ? "Saved venues have a map pin, so players can check in." : undefined}>
        <select id="venueId" name="venueId" value={venueId} onChange={(e) => setVenueId(e.target.value)} className={inputClass}>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          <option value={NEW}>+ New place: search or pick on the map</option>
          <option value="">Just type a place (no map pin, no check-in)</option>
        </select>
      </Field>
      {venueId === NEW && (
        <div className="grid gap-3 rounded-md border border-border p-3">
          <LocationPicker
            idPrefix="newvenue"
            lat={newLat}
            lng={newLng}
            radiusM={150}
            onPin={(la, ln) => {
              setNewLat(la);
              setNewLng(ln);
            }}
            onPlace={(p) => {
              setNewName((n) => n || p.label.slice(0, 80));
              setNewAddress([p.label, p.detail].filter(Boolean).join(", ").slice(0, 120));
            }}
          />
          <input type="hidden" name="newVenueLat" value={newLat} />
          <input type="hidden" name="newVenueLng" value={newLng} />
          <input type="hidden" name="newVenueAddress" value={newAddress} />
          <Field id="newVenueName" label="Name this place" error={fe.newVenueName} hint="Saved to your team's venues, so next time you just pick it.">
            <Input id="newVenueName" name="newVenueName" maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} error={fe.newVenueName} placeholder="e.g. Caraco Park, Pitch 3" />
          </Field>
        </div>
      )}
      {!venueId && (
        <Field id="locationText" label="Place" hint="Players get a map link. Check-in needs a place with a map pin.">
          <Input id="locationText" name="locationText" maxLength={120} defaultValue={initial.locationText} placeholder="e.g. Mooney's Bay Park, Ottawa" />
        </Field>
      )}
      <Field id="notes" label="Notes for the team" hint="Optional: kit colour, what to bring, parking">
        <textarea id="notes" name="notes" rows={3} maxLength={1000} defaultValue={initial.notes} className={`${inputClass} py-2.5`} />
      </Field>

      {!editing && kind === "training" && (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <label className="flex min-h-9 items-center gap-3 text-sm font-semibold">
            <input type="checkbox" name="repeat" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-5 accent-[var(--team)]" />
            Repeat every week
          </label>
          {repeat && (
            <Field id="repeatWeeks" label="For how many weeks?" error={fe.repeatWeeks}>
              <Input id="repeatWeeks" name="repeatWeeks" type="number" min={2} max={30} defaultValue="8" error={fe.repeatWeeks} className="max-w-32" />
            </Field>
          )}
        </div>
      )}
      {editing && inSeries && (
        <fieldset className="grid gap-1.5 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-semibold">This repeats weekly</legend>
          <label className="flex min-h-9 items-center gap-2.5 text-sm">
            <input type="radio" name="scope" value="one" defaultChecked className="size-4 accent-[var(--team)]" />
            Change only this one
          </label>
          <label className="flex min-h-9 items-center gap-2.5 text-sm">
            <input type="radio" name="scope" value="following" className="size-4 accent-[var(--team)]" />
            Change this and the following weeks
          </label>
        </fieldset>
      )}

      <Field id="sponsorVisible" label="Sponsors" hint="Sponsors see the date, opponent, venue and score. Never who's coming, notes or chat.">
        <select id="sponsorVisible" name="sponsorVisible" defaultValue={initial.sponsorVisible ?? "auto"} className={`${inputClass} sm:max-w-sm`}>
          <option value="auto">Usual: matches, tournaments and socials show to sponsors</option>
          <option value="show">Show this one to sponsors</option>
          <option value="hide">Keep this one from sponsors</option>
        </select>
      </Field>

      <label className="flex min-h-11 items-start gap-3 rounded-md bg-surface p-3">
        <input type="checkbox" name="notify" defaultChecked={!editing} className="mt-0.5 size-5 shrink-0 accent-[var(--team)]" />
        <span>
          <span className="block text-sm font-semibold">Tell the team</span>
          <span className="block text-xs text-muted">
            {editing ? "Players get an email saying what changed." : "Every player gets an email with Going / Maybe / Can't make it buttons."}
          </span>
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : label}
      </button>
    </form>
  );
}
