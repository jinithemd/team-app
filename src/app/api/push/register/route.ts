import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/data";
import { forgetDevice, saveDevice } from "@/lib/push/send";

// The app sends its push token here after sign-in. DELETE forgets it (signing out).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return new Response("Not signed in", { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { token?: string; platform?: string };
  const token = String(body.token ?? "");
  const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : null;
  if (!platform || !/^[\w:.-]{20,4096}$/.test(token)) return new Response("Bad token", { status: 400 });
  await saveDevice(user.id, token, platform);
  (await cookies()).set("clbx_push", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  const token = jar.get("clbx_push")?.value;
  if (token) await forgetDevice(token);
  jar.delete("clbx_push");
  return Response.json({ ok: true });
}
