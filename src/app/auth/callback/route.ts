import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

// Where sign-in links and Google send people back. Swaps the one-time code for a session.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const sb = await userClient();
  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };
  if (error) return NextResponse.redirect(new URL(`/login?expired=1&next=${encodeURIComponent(next)}`, url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
