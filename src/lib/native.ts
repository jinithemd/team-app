"use client";

/*
 * The Clbx phone app wraps the website (Capacitor). These helpers use the phone's own
 * features when we're inside the app and fall back to the browser's otherwise.
 */

export function inApp(): boolean {
  if (typeof window === "undefined") return false;
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
}

export function appPlatform(): "ios" | "android" | "web" {
  if (!inApp()) return "web";
  const c = (window as unknown as { Capacitor: { getPlatform: () => string } }).Capacitor;
  return c.getPlatform() === "ios" ? "ios" : "android";
}

/** Share a link with the phone's share sheet. Returns false if there's no sheet (copy instead). */
export async function shareLink(title: string, url: string): Promise<boolean> {
  if (inApp()) {
    const { Share } = await import("@capacitor/share");
    try {
      await Share.share({ title, text: title, url, dialogTitle: title });
    } catch {
      /* closed the sheet */
    }
    return true;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      /* closed the sheet */
    }
    return true;
  }
  return false;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Share (or save) an image through the phone's share sheet, inside the app. */
export async function shareImageInApp(blob: Blob, file: string, title: string, text: string) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const saved = await Filesystem.writeFile({ path: file, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title, text, files: [saved.uri], dialogTitle: title });
  } catch {
    /* closed the sheet */
  }
}
