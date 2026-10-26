/** @type {import("next").NextConfig} */
// NEXT_DIST lets the live (Supabase) build sit beside the sample-data build: NEXT_DIST=.next-live
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST || ".next",
  // Fonts the social-post images are drawn with, read from disk at request time.
  outputFileTracingIncludes: { "/api/share/[kind]/[id]": ["./src/app/api/share/fonts/*"] },
};
export default nextConfig;
