import { auctionImage } from "@/lib/auction/service";

// Auction team logos and player photos, for the auction room and the big screen (?t=<link token>).
const DATA_URL = /^data:(image\/(?:png|jpeg|webp|svg\+xml))(;base64)?,(.*)$/s;

export async function GET(req: Request, { params }: { params: Promise<{ aid: string; kind: string; id: string }> }) {
  const { aid, kind, id } = await params;
  if (!["squad", "player", "banner", "sponsors"].includes(kind)) return new Response(null, { status: 404 });
  const url = await auctionImage(aid, kind as "squad" | "player" | "banner" | "sponsors", id, new URL(req.url).searchParams.get("t")).catch(() => null);
  const m = url ? DATA_URL.exec(url) : null;
  if (!m) return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=60" } });
  const [, type, b64, body] = m;
  const bytes = b64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "utf8");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    },
  });
}
