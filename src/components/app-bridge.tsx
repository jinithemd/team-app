"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appPlatform, inApp } from "@/lib/native";

/*
 * Inside the Clbx phone app: clbx.ca links (from emails, texts, QR codes) open the right
 * screen, Android's back button goes back, and the status bar matches the app.
 * Does nothing in a normal browser.
 */
export function AppBridge() {
  const router = useRouter();
  useEffect(() => {
    if (!inApp()) return;
    document.documentElement.dataset.app = appPlatform();
    const subs: { remove: () => void }[] = [];
    (async () => {
      const { App } = await import("@capacitor/app");
      subs.push(
        await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            if (/(^|\.)clbx\.ca$/.test(u.hostname)) {
              // Sign-in links go through the server so the session cookie is set in the app.
              if (u.pathname.startsWith("/auth/")) location.href = u.pathname + u.search;
              else router.push(u.pathname + u.search + u.hash);
            }
          } catch {
            /* not a link we know */
          }
        }),
        await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) history.back();
          else void App.exitApp();
        }),
      );
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        if (appPlatform() === "android") {
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: "#06080D" });
        }
      } catch {
        /* older phones */
      }
    })();
    return () => subs.forEach((s) => s.remove());
  }, [router]);
  return null;
}

/** Signed-in screens: ask for notifications once, send the phone's token, open tapped notifications. */
export function AppPush() {
  const router = useRouter();
  useEffect(() => {
    if (!inApp()) return;
    const subs: { remove: () => void }[] = [];
    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      subs.push(
        await PushNotifications.addListener("registration", (t) => {
          void fetch("/api/push/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t.value, platform: appPlatform() }) });
        }),
        await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
          const url = (a.notification.data as { url?: string } | undefined)?.url;
          if (url && url.startsWith("/")) router.push(url);
        }),
      );
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
      if (perm.receive === "granted") await PushNotifications.register();
    })().catch(() => {});
    return () => subs.forEach((s) => s.remove());
  }, [router]);
  return null;
}
