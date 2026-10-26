"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { setMyPhotoAction } from "@/app/actions";
import { Avatar } from "@/components/ui";

/**
 * Add, change or remove your profile photo. The browser crops it to a square and shrinks it
 * to 320 px JPEG (about 20–40 KB) before it's sent, so big phone photos upload fast.
 */
export function ProfilePhoto({ name, photo }: { name: string; photo: string | null }) {
  const [preview, setPreview] = useState<string | null>(photo);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setMsg(null);
    if (!/^image\//.test(file.type)) return setMsg({ tone: "error", text: "Pick a photo (JPG, PNG, HEIC or WebP)." });
    if (file.size > 20_000_000) return setMsg({ tone: "error", text: "That photo is over 20 MB." });
    let img: HTMLImageElement;
    try {
      const url = URL.createObjectURL(file);
      img = new Image();
      img.src = url;
      await img.decode();
      URL.revokeObjectURL(url);
    } catch {
      return setMsg({ tone: "error", text: "Couldn't open that photo. Try a JPG or PNG." });
    }
    const size = 320;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    start(async () => {
      const r = await setMyPhotoAction(dataUrl);
      setMsg(r?.error ? { tone: "error", text: r.error } : { tone: "ok", text: "Photo saved. Your team sees it on the roster and in chat." });
      if (r?.error) setPreview(photo);
    });
  }

  function remove() {
    setMsg(null);
    setPreview(null);
    start(async () => {
      const r = await setMyPhotoAction("");
      setMsg(r?.error ? { tone: "error", text: r.error } : { tone: "ok", text: "Photo removed." });
    });
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={preview ? "Change your photo" : "Add a photo"}
        className="group relative shrink-0 rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Avatar name={name} size={96} src={preview} />
        <span aria-hidden className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-pill border-2 border-bg bg-fg text-bg">
          <Camera className="size-4" />
        </span>
      </button>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-semibold">
            <Camera aria-hidden className="size-4" />
            {pending ? "Saving…" : preview ? "Change photo" : "Add a photo"}
          </button>
          {preview && (
            <button type="button" onClick={remove} disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-muted hover:text-danger">
              <Trash2 aria-hidden className="size-4" />
              Remove
            </button>
          )}
        </div>
        <p role="status" className={`text-xs ${msg?.tone === "error" ? "text-danger" : "text-muted"}`}>
          {msg?.text ?? "A clear face photo helps teammates and captains know who's who."}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Photo file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
    </div>
  );
}
