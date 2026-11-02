import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps the Supabase sign-in fresh on every request (live mode only).
// Signed-out visitors to the home page see the front page (/welcome) instead of the sign-in
// screen. The phone app always goes straight to sign-in.
function welcome(request: NextRequest, signedIn: boolean, response?: NextResponse) {
  if (signedIn || request.nextUrl.pathname !== "/" || (request.headers.get("user-agent") ?? "").includes("ClbxApp")) return null;
  const url = request.nextUrl.clone();
  url.pathname = "/welcome";
  const out = NextResponse.rewrite(url);
  response?.cookies.getAll().forEach((c) => out.cookies.set(c));
  return out;
}

export async function middleware(request: NextRequest) {
  if (process.env.DATA_SOURCE !== "supabase") return welcome(request, !!request.cookies.get("demo_uid")?.value) ?? NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return welcome(request, !!data.user, response) ?? response;
}

export const config = {
  // Skips files, and the auction's every-second refreshes and images (they don't need the
  // sign-in refreshed, and checking it on each one slowed everything down).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auction/|api/cron/|api/stripe/|.*\\.(?:png|jpg|svg|webp|ico|woff2?)$).*)"],
};
