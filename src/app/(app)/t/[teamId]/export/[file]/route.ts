import { exportCsv } from "@/lib/data";

export async function GET(_: Request, { params }: { params: Promise<{ teamId: string; file: string }> }) {
  const { teamId, file } = await params;
  const out = await exportCsv(teamId, file.replace(/\.csv$/, "")).catch(() => null);
  if (!out) return new Response("Only captains and managers can export this.", { status: 403 });
  return new Response("\uFEFF" + out.body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "no-store" },
  });
}
