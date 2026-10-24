import { getClubPage } from "@/lib/data";

// Home-screen icon in the club's colours: its logo if it has one, otherwise its initials.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await getClubPage((await params).slug);
  if (!c) return new Response("Not found", { status: 404 });
  const esc = (s: string) => s.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const initials = esc(c.club.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase());
  const inner = c.club.logo
    ? `<image href="${esc(c.club.logo)}" x="72" y="72" width="368" height="368" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="256" y="300" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="200" fill="${esc(c.club.colorSecondary ?? "#FFFFFF")}">${initials}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="${esc(c.club.color)}"/>${inner}</svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}
