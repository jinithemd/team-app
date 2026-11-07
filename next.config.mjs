/** @type {import("next").NextConfig} */
// NEXT_DIST lets the live (Supabase) build sit beside the sample-data build: NEXT_DIST=.next-live
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST || ".next",
  // Fonts the social-post images are drawn with, read from disk at request time.
  // Pages you've just seen open instantly when you go back to them; saving anything refreshes them.
  experimental: { staleTimes: { dynamic: 30, static: 300 } },
  // Browser protections on every page: no framing (click-jacking), no type sniffing, HTTPS only,
  // only our own pages may ask for the camera or location (photos, pitch check-in).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self)" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: { "/api/share/[kind]/[id]": ["./src/app/api/share/fonts/*"] },
};
export default nextConfig;
