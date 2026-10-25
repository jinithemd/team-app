"use client";

import { useActionState, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Link2, LocateFixed, MapPin, Search } from "lucide-react";
import { saveVenueAction, type FormState } from "@/app/actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { isShortMapLink, parseLocation } from "@/lib/geo/parse-location";
import { searchPlaces, type Place } from "@/lib/geo/place-search";
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
  const [hits, setHits] = useState<Place[] | null>(null);
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

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  function onType(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    // A pasted link or coordinates in the search box works too.
    const direct = parseLocation(v);
    if (direct) {
      setHits(null);
      return setPin(direct.lat, direct.lng, "Pinned from what you pasted. Drag the pin onto the pitch if needed.", true);
    }
    if (v.trim().length < 3) return setHits(null);
    timer.current = setTimeout(() => void runSearch(v, false), 350);
  }

  async function runSearch(v: string, explicit: boolean) {
    const q = v.trim();
    if (q.length < 3) {
      if (explicit) setStatus("Type at least 3 letters of the place name or address.");
      return;
    }
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setBusy(true);
    try {
      const near = pinned ? { lat: latN!, lng: lngN! } : undefined;
      const results = await searchPlaces(q, near, ctl.signal);
      if (!ctl.signal.aborted) setHits(results);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setStatus((e as Error).message || "Search isn't working right now. Tap the map instead.");
    } finally {
      if (inflight.current === ctl) setBusy(false);
    }
  }

  function choose(h: Place) {
    setPin(h.lat, h.lng, `Pinned at ${h.label}. Zoom in and drag the pin onto the exact pitch.`, true);
    setQuery(h.label);
    if (!address.trim()) setAddress([h.label, h.detail].filter(Boolean).join(", ").slice(0, 120));
    setHits(null);
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
        <p className="-mt-1 text-sm text-muted">Set it from anywhere: search for the place, then drag the pin onto the pitch. Satellite view helps you find the exact field.</p>

        <div className="relative grid gap-1.5">
          <label htmlFor="place-q" className="text-sm font-semibold">
            Search for the place
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="place-q"
              role="combobox"
              aria-expanded={!!hits?.length}
              aria-controls="place-results"
              aria-autocomplete="list"
              value={query}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (hits?.[0]) choose(hits[0]);
                  else void runSearch(query, true);
                }
                if (e.key === "Escape") setHits(null);
              }}
              placeholder="Park, school, field or address"
              autoComplete="off"
              enterKeyHint="search"
              className="pl-9"
            />
          </div>
          {hits && hits.length > 0 && (
            <ul id="place-results" role="listbox" aria-label="Places" className="z-[500] grid max-h-72 overflow-y-auto rounded-md border border-border bg-bg shadow-card">
              {hits.map((h) => (
                <li key={`${h.lat},${h.lng},${h.label}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => choose(h)}
                    className="flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
                  >
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-team-ink" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold break-words">{h.label}</span>
                      {h.detail && <span className="block text-xs break-words text-muted">{h.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hits && hits.length === 0 && !busy && query.trim().length >= 3 && (
            <p className="text-xs text-muted">No matches. Try adding the city, or tap the spot on the map below.</p>
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
