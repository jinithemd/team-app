import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { screenCrestUrl, screenView } from "@/lib/auction/service";
import "@fontsource/barlow/latin-800-italic.css";
import "@fontsource/barlow/latin-700-italic.css";
import { AuctionScreen } from "./screen";

// The auction's big screen, opened from its private link on a TV, projector or laptop.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auction · big screen", robots: { index: false, follow: false } };

export default async function ScreenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await screenView(token);
  if (!v) notFound();
  return <AuctionScreen token={token} initial={v} crestUrl={await screenCrestUrl(token)} />;
}
