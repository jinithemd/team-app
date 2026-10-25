import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/data";
import { isShortMapLink, parseLocation } from "@/lib/geo/parse-location";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/brand";

/*
 * Venue pins without standing at the pitch.
 * - ?q=<place or address>: search OpenStreetMap (Nominatim). Their policy: a real user agent,
 *   at most one request a second, no type-ahead. We search only when someone taps Search.
 * - ?link=<short Google Maps link>: follow maps.app.goo.gl to the full link and read the pin.
 * Signed-in people only, so this isn't an open proxy.
 */

const UA = `${APP_NAME}/1.0 (+mailto:${SUPPORT_EMAIL})`;
let lastNominatim = 0;

export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const link = req.nextUrl.searchParams.get("link")?.trim() ?? "";

  if (link) {
    if (!isShortMapLink(link)) return NextResponse.json({ error: "That isn't a Google Maps share link." }, { status: 400 });
    let url = link;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }).catch(() => null);
      const next = res?.headers.get("location");
      if (!next) break;
      url = new URL(next, url).toString();
      const host = new URL(url).hostname;
      const pin = parseLocation(url);
      if (pin) return NextResponse.json({ results: [{ ...pin, label: "From your Google Maps link" }] });
      // Only keep following Google's own redirects.
      if (!/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/.test(host)) break;
    }
    return NextResponse.json({ error: "Couldn't read a pin from that link. Open it in your browser and copy the long link from the address bar instead." }, { status: 422 });
  }

  if (q.length < 3) return NextResponse.json({ error: "Type a place name or address." }, { status: 400 });
  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({ q: q.slice(0, 200), format: "jsonv2", limit: "5", addressdetails: "0" }).toString();
  const res = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "en-CA,en" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "Map search isn't answering. Try again in a moment, or drop the pin on the map." }, { status: 502 });
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return NextResponse.json({
    results: rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)),
  });
}
