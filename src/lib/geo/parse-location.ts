/*
 * Pull a map pin out of what people paste: plain coordinates ("44.2312, -76.486") or a
 * Google Maps / Apple Maps / OpenStreetMap link. Short links (maps.app.goo.gl) have no
 * coordinates in them; the server follows those (api/geocode).
 */

export type LatLng = { lat: number; lng: number };

const ok = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) ? { lat, lng } : null;

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

export function parseLocation(input: string): LatLng | null {
  const s = decodeURIComponent(input.trim().replace(/\+/g, " "));
  if (!s) return null;
  const tries: RegExp[] = [
    // Google: the place's own pin (!3d lat !4d lng) is more exact than the map centre (@).
    new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
    // Google / Apple query parameters: q=, query=, ll=, destination=, sll=
    new RegExp(String.raw`[?&](?:q|query|ll|sll|daddr|destination|center)=(?:loc:)?\s*${NUM}\s*,\s*${NUM}`),
    // Google map centre: /@44.23,-76.48,17z
    new RegExp(String.raw`@${NUM},${NUM}`),
    // OpenStreetMap: #map=17/44.23/-76.48 or ?mlat=..&mlon=..
    new RegExp(String.raw`#map=\d+(?:\.\d+)?/${NUM}/${NUM}`),
    new RegExp(String.raw`mlat=${NUM}&mlon=${NUM}`),
    // Plain "lat, lng" (also "lat lng")
    new RegExp(String.raw`^\s*${NUM}\s*[,\s]\s*${NUM}\s*$`),
  ];
  for (const re of tries) {
    const m = s.match(re);
    if (m) {
      const hit = ok(Number(m[1]), Number(m[2]));
      if (hit) return hit;
    }
  }
  return null;
}

/** Short share links whose target the server may look up (nothing else is fetched). */
export function isShortMapLink(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" && ["maps.app.goo.gl", "goo.gl"].includes(u.hostname);
  } catch {
    return false;
  }
}
