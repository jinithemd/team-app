"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { shareLink } from "@/lib/native";

/** Share the public page: the phone's share sheet when there is one, otherwise copy the link. */
export function ShareLink({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}${path}`;
    if (await shareLink(title, url)) return;
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm font-semibold text-fg">
      {copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
