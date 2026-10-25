"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { Link2, LocateFixed, Search } from "lucide-react";
import { saveVenueAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { isShortMapLink, parseLocation } from "@/lib/geo/parse-location";
import type { Venue } from "@/lib/data/types";

const MapPicker = dynamic(() => import("@/components/map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-surface sm:h-80" aria-label="Loading map" />,
});

type Hit = { lat: number; lng: number; label: string };
const fmt = (n: number) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");

export function VenueForm({ teamId, venue }: { teamId: string; venue: Venue | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVenueAction.bind(null, teamId, venue?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  const [lat, setLat] = useState(venue?.lat != null ? String(venue.lat) : "");
  const [lng, setLng] = useState(venue?.lng != null ? String(venue.lng) : "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [radius, setRadius] = useState(String(venue?.radiusM ?? 150));
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [focus, setFocus] = useState(0);

  const latN = lat.trim() ? Number(lat) : null;
  const lngN = lng.trim() ? Number(lng) : null;
  const pinned = latN != null && lngN != null && Number.isFinite(latN) && Number.isFinite(lngN);

  function setPin(la: number, ln: number, msg: string, fly: boolean) {
    setLat(fmt(la));
    setLng(fmt(ln));
    setStatus(msg);
    if (fly) setFocus((f) => f + 1);
  }

  async function search() {
    const q = query.trim();
    if (q.length < 3) return setStatus("Type a place name or address, e.g. Caraco Park Kingston.");
    // A pasted link or coordinates in the search box works too.
    const direct = parseLocation(q);
    if (direct) return setPin(direct.lat, direct.lng, "Pinned from what you pasted. Drag the pin onto the pitch if needed.", true);
    setBusy(true);
    setStatus("Searching…");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { results?: Hit[]; error?: string };
      if (!res.ok) return setStatus(body.error ?? "Search didn't work. Try again.");
      setHits(body.results ?? []);
      setStatus(body.results?.length ? "Pick the right place, then drag the pin onto the pitch." : "Nothing found. Try adding the city, or tap the map.");
    } catch {
      setStatus("Search didn't work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function usePaste(text: string) {
    const t = text.trim();
    if (!t) return;
    const hit = parseLocation(t);
    if (hit) return setPin(hit.lat, hit.lng, "Pinned from your link. Drag the pin onto the pitch if needed.", true);
    if (isShortMapLink(t)) {
      setBusy(true);
      setStatus("Reading your link…");
      try {
        const res = await fetch(`/api/geocode?link=${encodeURIComponent(t)}`);
        const body = (await res.json()) as { results?: Hit[]; error?: string };
        const r = body.results?.[0];
        if (r) return setPin(r.lat, r.lng, "Pinned from your link. Drag the pin onto the pitch if needed.", true);
        setStatus(body.error ?? "Couldn't read a pin from that link.");
      } catch {
        setStatus("Couldn't read that link. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setStatus("That doesn't look like a map link or coordinates. Try searching for the place instead.");
  }

  function here() {
    if (!("geolocation" in navigator)) return setStatus("This browser can't share its location.");
    setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => setPin(p.coords.latitude, p.coords.longitude, `Pinned where you are (± ${Math.round(p.coords.accuracy)} m).`, true),
      () => setStatus("Couldn't get your location. Search for the place or tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field id="name" label="Name" error={fe.name}>
        <Input id="name" name="name" maxLength={80} defaultValue={venue?.name} placeholder="e.g. Caraco Park, Pitch 3" error={fe.name} />
      </Field>
      <Field id="address" label="Address" hint="Optional">
        <Input id="address" name="address" maxLength={120} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">Map pin</legend>
        <p className="-mt-1 text-sm text-muted">Set it from anywhere: search for the place, paste a Google Maps link, or tap the map.</p>

        <div className="grid gap-1.5">
          <label htmlFor="place-q" className="text-sm font-semibold">
            Find the place
          </label>
          <div className="flex gap-2">
            <Input
              id="place-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="Park, school or address"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="button" onClick={search} disabled={busy} className={buttonClass("secondary", "md", "shrink-0")}>
              <Search aria-hidden />
              Search
            </button>
          </div>
          {hits && hits.length > 0 && (
            <ul className="grid gap-1" aria-label="Search results">
              {hits.map((h) => (
                <li key={`${h.lat},${h.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPin(h.lat, h.lng, "Pinned. Drag the pin onto the exact pitch if needed.", true);
                      if (!address.trim()) setAddress(h.label.split(",").slice(0, 3).join(",").slice(0, 120));
                      setHits(null);
                    }}
                    className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="place-link" className="text-sm font-semibold">
            Or paste a Google Maps link
          </label>
          <div className="flex gap-2">
            <Input
              id="place-link"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData.getData("text");
                setPaste(t);
                e.preventDefault();
                void usePaste(t);
              }}
              placeholder="https://maps.app.goo.gl/…"
              autoComplete="off"
              inputMode="url"
            />
            <button type="button" onClick={() => usePaste(paste)} disabled={busy} className={buttonClass("secondary", "md", "shrink-0")}>
              <Link2 aria-hidden />
              Use
            </button>
          </div>
          <p className="text-xs text-muted">In Google Maps, tap the place, then Share, then Copy link.</p>
        </div>

        <MapPicker
          lat={pinned ? latN : null}
          lng={pinned ? lngN : null}
          radiusM={Number(radius) >= 50 && Number(radius) <= 1000 ? Number(radius) : 150}
          focus={focus}
          onPick={(la, ln) => setPin(la, ln, "Pin moved.", false)}
        />

        <p role="status" aria-live="polite" className="text-xs text-muted">
          {status ?? (pinned ? "Drag the pin or tap the map to move it." : "No pin yet. Players can't check in here until there is one.")}
        </p>

        <button type="button" onClick={here} className="inline-flex min-h-10 items-center gap-2 justify-self-start rounded-md border border-border bg-surface px-3 text-sm font-semibold">
          <LocateFixed aria-hidden className="size-4" />
          At the pitch? Use where I am now
        </button>

        <details className="text-sm" open={fe.lat || fe.lng ? true : undefined}>
          <summary className="cursor-pointer font-semibold text-team-ink">Coordinates and other options</summary>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field id="lat" label="Latitude" error={fe.lat}>
                <Input id="lat" name="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="44.2312" error={fe.lat} />
              </Field>
              <Field id="lng" label="Longitude" error={fe.lng}>
                <Input id="lng" name="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-76.4860" error={fe.lng} />
              </Field>
            </div>
            {pinned && (
              <button
                type="button"
                onClick={() => {
                  setLat("");
                  setLng("");
                  setStatus("Pin removed. Save to keep it that way.");
                }}
                className="justify-self-start text-sm font-semibold text-danger"
              >
                Remove the pin
              </button>
            )}
          </div>
        </details>
      </fieldset>

      <Field id="radiusM" label="Check-in area" error={fe.radiusM} hint="How close counts as being there, in metres. Big parks need more. The circle on the map shows it.">
        <Input id="radiusM" name="radiusM" type="number" min={50} max={1000} step={10} value={radius} onChange={(e) => setRadius(e.target.value)} error={fe.radiusM} className="max-w-32" />
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
