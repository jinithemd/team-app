"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Link2, Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { Input, buttonClass } from "@/components/ui";
import { isShortMapLink, parseLocation } from "@/lib/geo/parse-location";
import { searchPlaces, type Place } from "@/lib/geo/place-search";

const MapPicker = dynamic(() => import("@/components/map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-md bg-surface sm:h-96" aria-label="Loading map" />,
});

const fmt = (n: number) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");

export interface PickedPlace {
  label: string;
  detail: string;
}

/**
 * Choose a location from anywhere: search as you type, paste a Google Maps link, tap or drag
 * on the map (street or satellite), or use where you are. Used by the venue form and by
 * "New place" on the event form. The parent owns lat/lng (strings, so the inputs can show
 * half-typed numbers).
 */
export function LocationPicker({
  idPrefix,
  lat,
  lng,
  radiusM,
  onPin,
  onPlace,
}: {
  idPrefix: string;
  lat: string;
  lng: string;
  radiusM: number;
  onPin: (lat: string, lng: string) => void;
  /** A search result was picked: the parent can fill a name or address from it. */
  onPlace?: (p: PickedPlace) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [focus, setFocus] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const latN = lat.trim() ? Number(lat) : null;
  const lngN = lng.trim() ? Number(lng) : null;
  const pinned = latN != null && lngN != null && Number.isFinite(latN) && Number.isFinite(lngN);

  function setPin(la: number, ln: number, msg: string, fly: boolean) {
    onPin(fmt(la), fmt(ln));
    setStatus(msg);
    if (fly) setFocus((f) => f + 1);
  }

  function onType(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    const direct = parseLocation(v);
    if (direct) {
      setHits(null);
      return setPin(direct.lat, direct.lng, "Pinned from what you pasted. Drag the pin onto the pitch if needed.", true);
    }
    if (v.trim().length < 3) {
      inflight.current?.abort();
      setBusy(false);
      return setHits(null);
    }
    setBusy(true);
    timer.current = setTimeout(() => void runSearch(v), 300);
  }

  async function runSearch(v: string) {
    const q = v.trim();
    if (q.length < 3) return setStatus("Type at least 3 letters of the place name or address.");
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setBusy(true);
    try {
      const results = await searchPlaces(q, pinned ? { lat: latN!, lng: lngN! } : undefined, ctl.signal);
      if (!ctl.signal.aborted) {
        setHits(results);
        setStatus(null);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setHits(null);
        setStatus(`${(e as Error).message || "Search isn't working right now."} You can still tap the spot on the map.`);
      }
    } finally {
      if (inflight.current === ctl) setBusy(false);
    }
  }

  function choose(h: Place) {
    setPin(h.lat, h.lng, `Pinned at ${h.label}. Zoom in and drag the pin onto the exact pitch.`, true);
    setQuery(h.label);
    setHits(null);
    onPlace?.({ label: h.label, detail: h.detail });
  }

  async function usePaste(text: string) {
    const t = text.trim();
    if (!t) return;
    const hit = parseLocation(t);
    if (hit) return setPin(hit.lat, hit.lng, "Pinned from your link. Drag the pin onto the pitch if needed.", true);
    if (!isShortMapLink(t)) return setStatus("That doesn't look like a map link or coordinates. Try searching for the place instead.");
    setBusy(true);
    setStatus("Reading your link…");
    try {
      const res = await fetch(`/api/geocode?link=${encodeURIComponent(t)}`);
      const body = (await res.json()) as { results?: { lat: number; lng: number }[]; error?: string };
      const r = body.results?.[0];
      if (r) setPin(r.lat, r.lng, "Pinned from your link. Drag the pin onto the pitch if needed.", true);
      else setStatus(body.error ?? "Couldn't read a pin from that link.");
    } catch {
      setStatus("Couldn't read that link. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
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

  const qId = `${idPrefix}-q`;
  const listId = `${idPrefix}-results`;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor={qId} className="text-sm font-semibold">
          Search for the place
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            id={qId}
            role="combobox"
            aria-expanded={!!hits?.length}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (hits?.[0]) choose(hits[0]);
                else void runSearch(query);
              }
              if (e.key === "Escape") setHits(null);
            }}
            placeholder="Park, school, field or address"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
            className="pr-9 pl-9"
          />
          {busy && <Loader2 aria-label="Searching" className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted" />}
        </div>
        {hits && hits.length > 0 && (
          <ul id={listId} role="listbox" aria-label="Places" className="grid max-h-72 overflow-y-auto rounded-md border border-border bg-bg shadow-card">
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

      <MapPicker lat={pinned ? latN : null} lng={pinned ? lngN : null} radiusM={radiusM} focus={focus} onPick={(la, ln) => setPin(la, ln, "Pin moved.", false)} />

      <p role="status" aria-live="polite" className="text-xs text-muted">
        {status ?? (pinned ? "Drag the pin or tap the map to move it." : "No pin yet. Search above, or zoom in and tap the spot on the map.")}
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={here} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold">
          <LocateFixed aria-hidden className="size-4" />
          Use where I am now
        </button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-team-ink">Paste a Google Maps link or coordinates</summary>
        <div className="mt-2 grid gap-1.5">
          <label htmlFor={`${idPrefix}-link`} className="sr-only">
            Google Maps link or coordinates
          </label>
          <div className="flex gap-2">
            <Input
              id={`${idPrefix}-link`}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData.getData("text");
                setPaste(t);
                e.preventDefault();
                void usePaste(t);
              }}
              placeholder="https://maps.app.goo.gl/… or 44.23, -76.48"
              autoComplete="off"
              inputMode="url"
            />
            <button type="button" onClick={() => usePaste(paste)} disabled={busy} className={buttonClass("secondary", "md", "shrink-0")}>
              <Link2 aria-hidden />
              Use
            </button>
          </div>
          <p className="text-xs text-muted">In Google Maps: tap the place, then Share, then Copy link.</p>
        </div>
      </details>
    </div>
  );
}
