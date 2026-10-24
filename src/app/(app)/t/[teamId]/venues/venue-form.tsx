"use client";

import { useActionState, useState } from "react";
import { LocateFixed } from "lucide-react";
import { saveVenueAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import type { Venue } from "@/lib/data/types";

export function VenueForm({ teamId, venue }: { teamId: string; venue: Venue | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVenueAction.bind(null, teamId, venue?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  const [lat, setLat] = useState(venue?.lat != null ? String(venue.lat) : "");
  const [lng, setLng] = useState(venue?.lng != null ? String(venue.lng) : "");
  const [locating, setLocating] = useState<string | null>(null);

  function here() {
    if (!("geolocation" in navigator)) return setLocating("This browser can't share its location.");
    setLocating("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(5));
        setLng(p.coords.longitude.toFixed(5));
        setLocating(`Pinned where you are (± ${Math.round(p.coords.accuracy)} m).`);
      },
      () => setLocating("Couldn't get your location. Type the coordinates instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field id="name" label="Name" error={fe.name}>
        <Input id="name" name="name" maxLength={80} defaultValue={venue?.name} placeholder="e.g. Caraco Park, Pitch 3" error={fe.name} />
      </Field>
      <Field id="address" label="Address" hint="Optional">
        <Input id="address" name="address" maxLength={120} defaultValue={venue?.address ?? ""} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Map pin</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="lat" label="Latitude" error={fe.lat}>
            <Input id="lat" name="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="44.2312" error={fe.lat} />
          </Field>
          <Field id="lng" label="Longitude" error={fe.lng}>
            <Input id="lng" name="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-76.4860" error={fe.lng} />
          </Field>
        </div>
        <button type="button" onClick={here} className="inline-flex min-h-10 items-center gap-2 justify-self-start rounded-md border border-border bg-surface px-3 text-sm font-semibold">
          <LocateFixed aria-hidden className="size-4" />
          Use where I am now
        </button>
        <p role="status" className="text-xs text-muted">
          {locating ?? "Standing at the pitch? Tap the button. Or copy the numbers from Google Maps (right-click the spot)."}
        </p>
      </fieldset>
      <Field id="radiusM" label="Check-in area" error={fe.radiusM} hint="How close counts as being there, in metres. Big parks need more.">
        <Input id="radiusM" name="radiusM" type="number" min={50} max={1000} step={10} defaultValue={venue?.radiusM ?? 150} error={fe.radiusM} className="max-w-32" />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className={buttonClass("primary", "md", "justify-self-start")} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : venue ? "Save venue" : "Add venue"}
      </button>
    </form>
  );
}
