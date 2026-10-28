"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { inApp, shareImageInApp } from "@/lib/native";

/** A ready-made post: preview, save it, or send it straight to Instagram/WhatsApp via the share sheet. */
export function ShareImage({ src, file, title, text, alt, square }: { src: string; file: string; title: string; text: string; alt: string; square?: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function share() {
    setMsg(null);
    try {
      const blob = await (await fetch(src)).blob();
      if (inApp()) {
        // The phone's own sheet: Instagram, WhatsApp, Save Image.
        await shareImageInApp(blob, file, title, text);
        return;
      }
      const f = new File([blob], file, { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title, text });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setMsg("Saved. Post it from your photos.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("Couldn't share it from here. Use Save instead.");
    }
  }
  return (
    <div className="grid gap-2">
      <img src={src} alt={alt} className={`w-full max-w-sm rounded-lg border border-border bg-surface ${square ? "aspect-square" : "aspect-[4/5]"}`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={share} className={buttonClass("primary", "md")}>
          <Share2 aria-hidden />
          Share
        </button>
        <a
          href={src}
          download={file}
          onClick={(e) => {
            if (inApp()) {
              e.preventDefault();
              void share();
            }
          }}
          className={buttonClass("secondary", "md")}
        >
          <Download aria-hidden />
          Save image
        </a>
      </div>
      {msg && (
        <p role="status" className="text-xs text-muted">
          {msg}
        </p>
      )}
    </div>
  );
}
