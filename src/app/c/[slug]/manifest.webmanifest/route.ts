import { getClubPage } from "@/lib/data";

// "Add to home screen" from the club page installs it under the club's name and colours.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await getClubPage((await params).slug);
  if (!c) return new Response("Not found", { status: 404 });
  return Response.json(
    {
      name: c.club.name,
      short_name: c.club.name.length > 12 ? c.club.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 12) : c.club.name,
      start_url: `/c/${c.club.slug}`,
      scope: "/",
      display: "standalone",
      background_color: "#FFFFFF",
      theme_color: c.club.color,
      icons: [{ src: `/c/${c.club.slug}/icon`, sizes: "512x512", type: "image/svg+xml", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
