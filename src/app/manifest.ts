import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

// "Add to Home Screen": installs Clbx with its own icon, opening full-screen like an app.
// Club pages (/c/<slug>) have their own manifest in the club's colours.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The launch screen while the first page loads: the app's own light background, not a black screen.
    background_color: "#FFFFFF",
    theme_color: "#06080D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
