import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LIVE } from "../mode";
import { liveContext } from "./live/context";

// Who's signed in. Sample-data build: a cookie naming a demo account. Live build: Supabase Auth.
// Screens never read cookies themselves; they ask the data layer.
const COOKIE = "demo_uid";

const liveUserId = cache(async (): Promise<string | null> => {
  const { userClient } = await import("../supabase/server");
  const sb = await userClient();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
});

export async function getSessionUserId(): Promise<string | null> {
  if (LIVE) return liveContext()?.uid ?? (await liveUserId());
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function setSessionUserId(id: string) {
  if (LIVE) throw new Error("Live build: sign-in goes through Supabase Auth");
  const jar = await cookies();
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession() {
  if (LIVE) {
    const { userClient } = await import("../supabase/server");
    await (await userClient()).auth.signOut();
    return;
  }
  const jar = await cookies();
  jar.delete(COOKIE);
}
