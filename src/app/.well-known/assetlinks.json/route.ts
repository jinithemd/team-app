// Android: lets clbx.ca links open in the Clbx app (App Links). ANDROID_CERT_SHA256 is the
// app signing key's SHA-256 fingerprint from Google Play Console (App integrity), comma-separated.
export const dynamic = "force-dynamic";

export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return Response.json(
    prints.length
      ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "ca.clbx.app", sha256_cert_fingerprints: prints } }]
      : [],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
