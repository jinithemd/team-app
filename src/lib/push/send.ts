import "server-only";
import { createSign, sign as edSign, createPrivateKey } from "node:crypto";
import http2 from "node:http2";
import { LIVE } from "../mode";

/*
 * Push notifications to the Clbx phone apps, sent alongside the emails.
 *   Android: Firebase Cloud Messaging (HTTP v1). FCM_SERVICE_ACCOUNT = the Firebase service
 *            account JSON (or base64 of it).
 *   iPhone:  Apple's push service directly. APNS_KEY (the .p8 key text, or base64 of it),
 *            APNS_KEY_ID, APNS_TEAM_ID; optional APNS_BUNDLE_ID (ca.clbx.app) and
 *            APNS_SANDBOX=1 for development builds.
 * Missing keys just mean no pushes for that platform. Dead tokens are removed.
 */

export interface PushMessage {
  title: string;
  body: string;
  /** Path to open when tapped, like /t/<id>/e/<id>. */
  url?: string;
}

type Device = { token: string; platform: "ios" | "android" };

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const maybeB64 = (v: string) => (v.trim().startsWith("{") || v.includes("-----BEGIN") ? v : Buffer.from(v, "base64").toString("utf8"));

// ---- Android (FCM) --------------------------------------------------------

let fcmToken: { token: string; exp: number } | null = null;
async function fcmAccess(sa: { client_email: string; private_key: string }) {
  if (fcmToken && fcmToken.exp > Date.now() + 60_000) return fcmToken.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claim}`);
  const jwt = `${head}.${claim}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("FCM auth failed");
  fcmToken = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return fcmToken.token;
}

/** true = delivered, false = the token is dead. */
async function sendAndroid(token: string, m: PushMessage): Promise<boolean> {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return true;
  const sa = JSON.parse(maybeB64(raw)) as { project_id: string; client_email: string; private_key: string };
  const access = await fcmAccess(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title, body: m.body },
        data: m.url ? { url: m.url } : {},
        android: { priority: "high", notification: { color: "#06080D", default_sound: true } },
      },
    }),
  });
  if (res.ok) return true;
  const txt = await res.text();
  if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*token/i.test(txt)) return false;
  throw new Error(`FCM ${res.status}: ${txt.slice(0, 200)}`);
}

// ---- iPhone (APNs) --------------------------------------------------------

let apnsJwt: { jwt: string; at: number } | null = null;
function apnsAuth() {
  if (apnsJwt && Date.now() - apnsJwt.at < 40 * 60_000) return apnsJwt.jwt;
  const key = createPrivateKey(maybeB64(process.env.APNS_KEY!));
  const head = b64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }));
  const claim = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const sig = edSign("sha256", Buffer.from(`${head}.${claim}`), { key, dsaEncoding: "ieee-p1363" });
  apnsJwt = { jwt: `${head}.${claim}.${b64url(sig)}`, at: Date.now() };
  return apnsJwt.jwt;
}

function sendIos(token: string, m: PushMessage): Promise<boolean> {
  if (!process.env.APNS_KEY || !process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID) return Promise.resolve(true);
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const body = JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: "default" }, url: m.url ?? "/" });
  return new Promise((resolve, reject) => {
    const client = http2.connect(host);
    client.on("error", reject);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsAuth()}`,
      "apns-topic": process.env.APNS_BUNDLE_ID || "ca.clbx.app",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      client.close();
      if (status === 200) resolve(true);
      else if (status === 410 || /BadDeviceToken|Unregistered/.test(data)) resolve(false);
      else reject(new Error(`APNs ${status}: ${data.slice(0, 200)}`));
    });
    req.on("error", (e) => {
      client.close();
      reject(e);
    });
    req.end(body);
  });
}

// ---- devices --------------------------------------------------------------

async function admin() {
  const { adminClient } = await import("../supabase/server");
  return adminClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
}

export async function saveDevice(userId: string, token: string, platform: "ios" | "android") {
  if (!LIVE) return;
  const { error } = await (await admin()).from("push_devices").upsert({ token, user_id: userId, platform, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) console.error("[push] save device:", error.message);
}

export async function forgetDevice(token: string) {
  if (!LIVE) return;
  await (await admin()).from("push_devices").delete().eq("token", token);
}

export const pushConfigured = () => !!process.env.FCM_SERVICE_ACCOUNT || !!process.env.APNS_KEY;

/** Push to every phone a person is signed in on. Never throws. */
export async function pushToUser(userId: string, m: PushMessage) {
  if (!LIVE || !pushConfigured()) return;
  try {
    const sb = await admin();
    const { data } = await sb.from("push_devices").select("token, platform").eq("user_id", userId);
    for (const d of (data ?? []) as Device[]) {
      try {
        const ok = d.platform === "ios" ? await sendIos(d.token, m) : await sendAndroid(d.token, m);
        if (!ok) await sb.from("push_devices").delete().eq("token", d.token);
      } catch (e) {
        console.error("[push]", d.platform, (e as Error).message);
      }
    }
  } catch (e) {
    console.error("[push]", (e as Error).message);
  }
}

/** Push for an email that was just sent: same words, opening the email's first link. */
export async function pushForEmail(email: string, mail: { subject: string; text: string; links: { href: string }[] }) {
  if (!LIVE || !pushConfigured() || !email) return;
  const sb = await admin();
  const { data } = await sb.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!data) return;
  const first = mail.links.find((l) => /^https?:\/\/(www\.)?clbx\.ca\//.test(l.href) || l.href.startsWith("/"));
  const url = first ? first.href.replace(/^https?:\/\/(www\.)?clbx\.ca/, "") || "/" : "/";
  const body = mail.text.replace(/\s+/g, " ").trim();
  await pushToUser(String((data as { id: string }).id), {
    title: mail.subject.replace(/^Clbx · /, "").slice(0, 120),
    body: body.length > 170 ? `${body.slice(0, 167)}…` : body,
    url,
  });
}
