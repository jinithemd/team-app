"use client";

/*
 * Place search for venue pins. Suggestions come straight from the browser to Photon
 * (photon.komoot.io, OpenStreetMap data, made for search-as-you-type). If Photon can't be
 * reached, our own /api/geocode (Nominatim) is tried instead.
 */

export type Place = { lat: number; lng: number; label: string; detail: string };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

function describe(p: Record<string, string | undefined>) {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const label = p.name || street || p.city || "Unnamed place";
  const detail = [p.name ? street : "", p.district || p.locality, p.city, p.state, p.country].filter((x) => x && x !== label).join(", ");
  return { label, detail };
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "6");
  u.searchParams.set("lang", "en");
  if (near) {
    u.searchParams.set("lat", String(near.lat));
    u.searchParams.set("lon", String(near.lng));
  }
  try {
    const res = await fetch(u, { signal });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { features: PhotonFeature[] };
    const seen = new Set<string>();
    return body.features
      .map((f) => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], ...describe(f.properties) }))
      .filter((p) => {
        const k = `${p.label}|${p.detail}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal });
    const body = (await res.json()) as { results?: { lat: number; lng: number; label: string }[]; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Search isn't working right now.");
    return (body.results ?? []).map((r) => {
      const [label, ...rest] = r.label.split(", ");
      return { lat: r.lat, lng: r.lng, label, detail: rest.slice(0, 4).join(", ") };
    });
  }
}
