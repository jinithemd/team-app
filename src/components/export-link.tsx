"use client";

import { useState } from "react";

/*
 * Downloads a spreadsheet without leaving the app. A plain link opens the CSV full screen on
 * iPhone (home-screen app or phone app) with no way back, so we fetch it and hand it to the
 * phone's share sheet (Save to Files, Numbers, Mail…). Computers just download it.
 */
export function ExportLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? href.split("/").pop() ?? "export.csv";
      const file = new File([blob], name, { type: blob.type || "text/csv" });
      const touch = matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
        } catch (x) {
          if ((x as Error).name !== "AbortError") throw x;
        }
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setErr("Couldn't get the spreadsheet. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a href={href} onClick={go} aria-busy={busy || undefined} className={className}>
        {busy ? "Preparing…" : children}
      </a>
      {err && (
        <span role="alert" className="text-xs text-danger">
          {err}
        </span>
      )}
    </>
  );
}
