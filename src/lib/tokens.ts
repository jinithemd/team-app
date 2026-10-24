// Signed, expiring tokens for links in emails (one-tap RSVP, invites).
// The real backend uses the same format with RSVP_LINK_SECRET set in the environment.
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.RSVP_LINK_SECRET || "dev-only-secret-change-me";

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

export function sign(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = b64url(JSON.stringify({ ...payload, x: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const mac = b64url(createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${mac}`;
}

export function verify<T extends Record<string, unknown>>(token: string): T | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.x !== "number" || data.x < Date.now() / 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}
