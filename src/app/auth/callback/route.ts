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
  let error: { message: string } | null = new Error("missing code");
  if (tokenHash) {
    // Our own sign-in emails: works in any browser. Try the link's type, then the general one.
    for (const t of [...new Set([type, "email", "magiclink", "signup"].filter(Boolean))] as EmailOtpType[]) {
      ({ error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: t }));
      if (!error) break;
    }
  } else if (code) {
    // Google sign-in (and older email links, which need the browser that asked for them).
    ({ error } = await sb.auth.exchangeCodeForSession(code));
  }
  if (error) {
    console.error("[auth] callback:", error.message);
    // Already signed in (a second tap on the same link, or a mail app opening it twice): carry on.
    const { data } = await sb.auth.getUser();
    if (data.user) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(new URL(`/login?expired=1&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
