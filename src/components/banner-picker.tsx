"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const MAX_CHARS = 1_900_000;

/**
 * Pick a wide banner or a poster. Keeps its shape (no cropping), shrinks it to at most
 * 1600 px wide / 2000 px tall in the browser, and posts it as a JPEG data URL in a hidden
 * field. "keep" means unchanged, "" means remove.
 */
export function BannerPicker({ name, initial, label, hint }: { name: string; initial: string | null; label: string; hint?: string }) {
  const [value, setValue] = useState<string | null>(initial);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Use a JPG, PNG or WebP image.");
    if (file.size > 20_000_000) return setError("That image is over 20 MB.");
    setBusy(true);
    try {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.src = src;
      await img.decode();
      URL.revokeObjectURL(src);
      let scale = Math.min(1, 1600 / img.width, 2000 / img.height);
      let out = "";
      for (let tries = 0; tries < 5; tries++) {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", tries < 2 ? 0.85 : 0.75);
        if (out.length <= MAX_CHARS) break;
        scale *= 0.8;
      }
      if (out.length > MAX_CHARS) return setError("That image is too detailed to use. Try a smaller one.");
      setValue(out);
      setChanged(true);
    } catch {
      setError("Couldn't read that image. Try another.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <input type="hidden" name={name} value={changed ? value ?? "" : "keep"} />
      {value ? (
        <img src={value} alt="Banner preview" className="max-h-80 w-full rounded-lg border border-border bg-surface object-contain" />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid aspect-[3/1] w-full place-items-center rounded-lg border-2 border-dashed border-border bg-surface text-sm font-semibold text-muted"
        >
          <span className="flex items-center gap-2">
            <ImagePlus aria-hidden className="size-5" />
            {busy ? "Preparing…" : "Add a banner or poster"}
          </span>
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        {value && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-semibold">
            <ImagePlus aria-hidden className="size-4" />
            {busy ? "Preparing…" : "Change"}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue(null);
              setChanged(true);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-danger"
          >
            <X aria-hidden className="size-4" />
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
