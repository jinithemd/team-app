import { screenView } from "@/lib/auction/service";

// The big screen polls this about once a second (read-only, from the private link).
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const v = await screenView((await params).token).catch(() => null);
  if (!v) return new Response("Not found", { status: 404 });
  return Response.json(v, { headers: { "Cache-Control": "no-store" } });
}
