"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";

/*
 * Fit a photo into the round profile frame: drag to move it, pinch / scroll / the slider to
 * zoom. Returns a square JPEG of the framed part (the circle is what people see).
 */

const V = 280; // the frame on screen, px
const MAX = 4;

type Pt = { x: number; y: number };

export function PhotoCropper({ src, size = 320, onCancel, onDone }: { src: string; size?: number; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState<Pt>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  useEffect(() => {
    saveRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const base = img ? V / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const dw = img ? img.naturalWidth * base * zoom : V;
  const dh = img ? img.naturalHeight * base * zoom : V;

  // Keep the frame covered: never show a gap at the edges.
  const clamp = useCallback(
    (p: Pt, z = zoom): Pt => {
      if (!img) return p;
      const w = img.naturalWidth * base * z;
      const h = img.naturalHeight * base * z;
      const mx = (w - V) / 2;
      const my = (h - V) / 2;
      return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
    },
    [img, base, zoom],
  );

  const setZ = (z: number) => {
    const nz = Math.max(1, Math.min(MAX, z));
    setZoom(nz);
    setOff((o) => clamp({ x: (o.x * nz) / zoom, y: (o.y * nz) / zoom }, nz));
  };

  function down(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
    }
  }
  function move(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZ((pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d);
    } else if (pointers.current.size === 1) {
      setOff((o) => clamp({ x: o.x + now.x - prev.x, y: o.y + now.y - prev.y }));
    }
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }
  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 30 : 10;
    const d: Record<string, Pt> = { ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 }, ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step } };
    if (d[e.key]) {
      e.preventDefault();
      setOff((o) => clamp({ x: o.x + d[e.key].x, y: o.y + d[e.key].y }));
    } else if (e.key === "+" || e.key === "=") setZ(zoom + 0.2);
    else if (e.key === "-") setZ(zoom - 0.2);
  }

  function save() {
    if (!img) return;
    const k = size / V;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, ((V - dw) / 2 + off.x) * k, ((V - dh) / 2 + off.y) * k, dw * k, dh * k);
    onDone(c.toDataURL("image/jpeg", 0.88));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(6,8,13,0.72)] p-4" role="dialog" aria-modal="true" aria-labelledby="crop-h" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="grid w-full max-w-sm gap-4 rounded-xl bg-bg p-5 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <h2 id="crop-h" className="font-display text-xl font-bold">
            Fit your photo
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid size-10 place-items-center rounded-pill text-muted hover:bg-surface">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div
          tabIndex={0}
          role="application"
          aria-label="Photo position. Drag, or use the arrow keys to move it; plus and minus to zoom."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(e) => setZ(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          onKeyDown={key}
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-lg bg-sunken select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:cursor-grabbing"
          style={{ width: V, height: V }}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ width: dw, height: dh, left: (V - dw) / 2 + off.x, top: (V - dh) / 2 + off.y }}
            />
          )}
          {/* What people will see: the circle. The corners are dimmed. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-pill shadow-[0_0_0_200px_rgba(6,8,13,0.55)] ring-2 ring-[#FFFFFF]" />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setZ(zoom - 0.25)} aria-label="Zoom out" className="grid size-10 shrink-0 place-items-center rounded-pill border border-border">
            <Minus aria-hidden className="size-4" />
          </button>
          <label htmlFor="crop-zoom" className="sr-only">
            Zoom
          </label>
          <input id="crop-zoom" type="range" min={1} max={MAX} step={0.01} value={zoom} onChange={(e) => setZ(Number(e.target.value))} className="w-full accent-[var(--fg)]" />
          <button type="button" onClick={() => setZ(zoom + 0.25)} aria-label="Zoom in" className="grid size-10 shrink-0 place-items-center rounded-pill border border-border">
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        <p className="text-center text-xs text-muted">Drag to move · pinch or slide to zoom</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-md border border-border font-semibold">
            Cancel
          </button>
          <button ref={saveRef} type="button" onClick={save} disabled={!img} className="min-h-11 rounded-md bg-fg font-semibold text-bg disabled:opacity-50">
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
