/** @type {import("next").NextConfig} */
// NEXT_DIST lets the live (Supabase) build sit beside the sample-data build: NEXT_DIST=.next-live
const nextConfig = { reactStrictMode: true, distDir: process.env.NEXT_DIST || ".next" };
export default nextConfig;
