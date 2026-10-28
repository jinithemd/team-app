// iPhone: lets clbx.ca links open in the Clbx app (Universal Links). APPLE_TEAM_ID comes
// from the Apple Developer account (Membership details).
export const dynamic = "force-dynamic";

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const apps = team ? [`${team}.${process.env.APNS_BUNDLE_ID || "ca.clbx.app"}`] : [];
  return Response.json(
    { applinks: { details: apps.length ? [{ appIDs: apps, components: [{ "/": "/api/*", exclude: true }, { "/": "*" }] }] : [] } },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
