"use client";

import { useActionState, useState } from "react";
import { saveVenueAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { LocationPicker } from "@/components/location-picker";
import type { Venue } from "@/lib/data/types";

export function VenueForm({ teamId, venue }: { teamId: string; venue: Venue | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVenueAction.bind(null, teamId, venue?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  const [name, setName] = useState(venue?.name ?? "");
  const [lat, setLat] = useState(venue?.lat != null ? String(venue.lat) : "");
  const [lng, setLng] = useState(venue?.lng != null ? String(venue.lng) : "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [radius, setRadius] = useState(String(venue?.radiusM ?? 150));
  const r = Number(radius);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Where is it?</legend>
        <LocationPicker
          idPrefix="venue"
          lat={lat}
          lng={lng}
          radiusM={r >= 50 && r <= 1000 ? r : 150}
          onPin={(la, ln) => {
            setLat(la);
            setLng(ln);
          }}
          onPlace={(p) => {
            if (!name.trim()) setName(p.label.slice(0, 80));
            if (!address.trim()) setAddress([p.label, p.detail].filter(Boolean).join(", ").slice(0, 120));
          }}
        />
      </fieldset>
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      {(fe.lat || fe.lng) && <p className="text-sm text-danger">{fe.lat ?? fe.lng}</p>}

      <Field id="name" label="Name" error={fe.name} hint="What your team calls it, e.g. Caraco Park, Pitch 3">
        <Input id="name" name="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={fe.name} />
      </Field>
      <Field id="address" label="Address" hint="Optional">
        <Input id="address" name="address" maxLength={120} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field id="radiusM" label="Check-in area" error={fe.radiusM} hint="How close counts as being there, in metres. Big parks need more. The circle on the map shows it.">
        <Input id="radiusM" name="radiusM" type="number" min={50} max={1000} step={10} value={radius} onChange={(e) => setRadius(e.target.value)} error={fe.radiusM} className="max-w-32" />
      </Field>
      {lat && (
        <button
          type="button"
          onClick={() => {
            setLat("");
            setLng("");
          }}
          className="justify-self-start text-sm font-semibold text-danger"
        >
          Remove the map pin
        </button>
      )}
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
