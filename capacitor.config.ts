import type { CapacitorConfig } from "@capacitor/cli";

/*
 * The Clbx phone apps (App Store and Google Play). They open the live site, clbx.ca, inside
 * the app, so every change to the website reaches the apps straight away; the native parts
 * (push notifications, the share sheet, app links) come from Capacitor plugins.
 * native/www is only the "can't connect" page shown when the phone is offline.
 */
const config: CapacitorConfig = {
  appId: "ca.clbx.app",
  appName: "Clbx",
  webDir: "native/www",
  server: {
    url: process.env.CLBX_APP_URL || "https://clbx.ca",
    errorPath: "index.html",
    // Stay inside the app for our own pages and Stripe's; everything else opens in the browser.
    allowNavigation: ["clbx.ca", "www.clbx.ca", "checkout.stripe.com", "connect-js.stripe.com", "*.stripe.com"],
    androidScheme: "https",
  },
  appendUserAgent: "ClbxApp",
  backgroundColor: "#06080D",
  ios: { contentInset: "never", limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: "#06080D", showSpinner: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
