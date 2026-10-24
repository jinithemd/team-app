import "server-only";
import { cookies } from "next/headers";

// Fake session for the sample-data build. replica-backend replaces this with Supabase Auth
// (same function names), so screens never read cookies themselves.
const COOKIE = "demo_uid";

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function setSessionUserId(id: string) {
  const jar = await cookies();
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
