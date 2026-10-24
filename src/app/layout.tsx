import type { Metadata, Viewport } from "next";
// Self-hosted (SIL Open Font License): no request to Google, and pages never wait on a font CDN.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "./globals.css";
import { getSessionUser } from "@/lib/data";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1116" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const theme = user?.theme && user.theme !== "system" ? user.theme : undefined;
  return (
    <html lang="en-CA" data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
