"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Circle, Map as LMap, Marker } from "leaflet";

/**
 * A map to place (and fine-tune) a venue pin from anywhere: tap the map or drag the pin.
 * The circle shows the check-in area. OpenStreetMap tiles, credited in the corner.
 */
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
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const L = useRef<typeof import("leaflet") | null>(null);

  // Draw (or move) the pin and circle.
  function place(la: number, ln: number, r: number, recenter: boolean) {
    const Lf = L.current;
    if (!Lf || !map.current) return;
    if (!pin.current) {
      const icon = Lf.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--team,#2563eb);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      pin.current = Lf.marker([la, ln], { draggable: true, icon, keyboard: true, title: "Venue pin. Drag to move." }).addTo(map.current);
      pin.current.on("dragend", () => {
        const p = pin.current!.getLatLng();
        pickRef.current(p.lat, p.lng);
      });
      area.current = Lf.circle([la, ln], { radius: r, color: "var(--team,#2563eb)", weight: 2, fillOpacity: 0.12 }).addTo(map.current);
    } else {
      pin.current.setLatLng([la, ln]);
      area.current!.setLatLng([la, ln]).setRadius(r);
    }
    if (recenter) map.current.setView([la, ln], Math.max(map.current.getZoom(), 16));
  }

  useEffect(() => {
    let dead = false;
    import("leaflet").then((Lf) => {
      if (dead || !box.current || map.current) return;
      L.current = Lf;
      const has = lat != null && lng != null;
      map.current = Lf.map(box.current, { zoomControl: true, attributionControl: true }).setView(has ? [lat!, lng!] : [45.5, -78], has ? 16 : 4);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      map.current.on("click", (e) => {
        pickRef.current(e.latlng.lat, e.latlng.lng);
      });
      if (has) place(lat!, lng!, radiusM, false);
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = pin.current = area.current = null;
    };
    // The map is created once; later changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lat == null || lng == null || !map.current) return;
    place(lat, lng, radiusM, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusM]);

  useEffect(() => {
    if (focus && lat != null && lng != null && map.current) map.current.setView([lat, lng], 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div
      ref={box}
      role="application"
      aria-label="Map. Tap where the pitch is, or drag the pin."
      className="z-0 h-64 w-full overflow-hidden rounded-md border border-border sm:h-80"
    />
  );
}
