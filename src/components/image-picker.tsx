"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

/**
 * Pick a logo or crest. Shrinks it to 256 px in the browser and posts it as a data URL in a
 * hidden field; the real build uploads to Storage instead. "keep" means unchanged.
 */
export function ImagePicker({ name, initial, label, fallback }: { name: string; initial: string | null; label: string; fallback: React.ReactNode }) {
  const [value, setValue] = useState<string | null>(initial);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) return setError("Use a PNG, JPG, WebP or SVG.");
    if (file.size > 5_000_000) return setError("That file is over 5 MB.");
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    if (file.type === "image/svg+xml") {
      setValue(url);
      setChanged(true);
      return;
    }
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    setValue(c.toDataURL("image/png"));
    setChanged(true);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <input type="hidden" name={name} value={changed ? value ?? "" : "keep"} />
      <div className="flex items-center gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
          {value ? <img src={value} alt="" className="size-full object-cover" /> : fallback}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-semibold">
            <ImagePlus aria-hidden className="size-4" />
            {value ? "Change" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue(null);
                setChanged(true);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-muted hover:text-danger"
            >
              <X aria-hidden className="size-4" />
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          aria-label={`${label} file`}
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
      </div>
      <p className="text-xs text-muted">{error ?? "Square works best. We'll crop it to a square."}</p>
    </div>
  );
}
