"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Circle, Map as LMap, Marker, TileLayer } from "leaflet";

/**
 * A map to place (and fine-tune) a venue pin from anywhere: tap the map or drag the pin.
 * The circle shows the check-in area. Street map or satellite (handy for finding the exact
 * pitch). If one street-map server won't serve tiles, it switches to another by itself.
 */

const STREETS = [
  {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "",
  },
  {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
];
const SATELLITE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
  subdomains: "",
};

export function MapPicker({
  lat,
  lng,
  radiusM,
  focus,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  radiusM: number;
  /** Bump to fly to the pin (after a search or a pasted link). */
  focus: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const area = useRef<Circle | null>(null);
  const tiles = useRef<TileLayer | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const L = useRef<typeof import("leaflet") | null>(null);
  const [view, setView] = useState<"map" | "satellite">("map");
  const [streetIdx, setStreetIdx] = useState(0);
  const [broken, setBroken] = useState(false);
  const [ready, setReady] = useState(false);

  function place(la: number, ln: number, r: number) {
    const Lf = L.current;
    if (!Lf || !map.current) return;
    if (!pin.current) {
      const icon = Lf.divIcon({
        className: "",
        html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:var(--team,#2563eb);border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);transform:rotate(-45deg)"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      pin.current = Lf.marker([la, ln], { draggable: true, icon, keyboard: true, title: "Venue pin. Drag to move." }).addTo(map.current);
      pin.current.on("dragend", () => {
        const p = pin.current!.getLatLng();
        pickRef.current(p.lat, p.lng);
      });
      area.current = Lf.circle([la, ln], { radius: r, color: "#2563eb", weight: 2, fillOpacity: 0.15, interactive: false }).addTo(map.current);
    } else {
      pin.current.setLatLng([la, ln]);
      area.current!.setLatLng([la, ln]).setRadius(r);
    }
  }

  // Create the map once.
  useEffect(() => {
    let dead = false;
    let ro: ResizeObserver | null = null;
    import("leaflet").then((Lf) => {
      if (dead || !box.current || map.current) return;
      L.current = Lf;
      const has = lat != null && lng != null;
      map.current = Lf.map(box.current, { zoomControl: true, attributionControl: true, tapTolerance: 20 }).setView(
        has ? [lat!, lng!] : [45.5, -78],
        has ? 16 : 5,
      );
      map.current.attributionControl.setPrefix(false);
      map.current.on("click", (e) => pickRef.current(e.latlng.lat, e.latlng.lng));
      if (has) place(lat!, lng!, radiusM);
      setReady(true);
      // A map drawn before its box has its final size shows grey patches: redraw on resize.
      ro = new ResizeObserver(() => map.current?.invalidateSize());
      ro.observe(box.current);
      setTimeout(() => map.current?.invalidateSize(), 300);
    });
    return () => {
      dead = true;
      ro?.disconnect();
      map.current?.remove();
      map.current = pin.current = area.current = tiles.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile layer: street map (with fallback) or satellite.
  useEffect(() => {
    const Lf = L.current;
    if (!ready || !Lf || !map.current) return;
    tiles.current?.remove();
    const src = view === "satellite" ? SATELLITE : STREETS[streetIdx];
    const layer = Lf.tileLayer(src.url, { maxZoom: 19, attribution: src.attribution, subdomains: src.subdomains || "abc", crossOrigin: false });
    let loaded = 0;
    let failed = 0;
    layer.on("tileload", () => {
      loaded++;
      setBroken(false);
    });
    layer.on("tileerror", () => {
      failed++;
      if (loaded === 0 && failed >= 4) {
        if (view === "map" && streetIdx < STREETS.length - 1) setStreetIdx(streetIdx + 1);
        else setBroken(true);
      }
    });
    layer.addTo(map.current);
    tiles.current = layer;
  }, [view, streetIdx, ready]);

  useEffect(() => {
    if (lat == null || lng == null || !map.current) return;
    place(lat, lng, radiusM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusM]);

  useEffect(() => {
    if (focus && lat != null && lng != null && map.current) map.current.setView([lat, lng], 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <div
          ref={box}
          role="application"
          aria-label="Map. Tap where the pitch is, or drag the pin."
          className="z-0 h-72 w-full overflow-hidden rounded-md border border-border bg-surface sm:h-96"
        />
        <div className="absolute top-2 right-2 z-[400] flex overflow-hidden rounded-md border border-border bg-bg text-xs font-semibold shadow-card" role="group" aria-label="Map type">
          {(["map", "satellite"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-9 px-3 capitalize ${view === v ? "bg-fg text-bg" : "text-fg"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {broken && (
        <p className="text-xs text-danger">The map images aren&apos;t loading on this connection. You can still search for the place or paste a link; the pin is saved either way.</p>
      )}
    </div>
  );
}
