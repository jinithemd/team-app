import { auctionView } from "@/lib/auction/service";

// The live auction room polls this about once a second. It also settles a lot whose clock ran out.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await auctionView((await params).id).catch(() => null);
  if (!v) return new Response("Not found", { status: 404 });
  return Response.json(v, { headers: { "Cache-Control": "no-store" } });
}
