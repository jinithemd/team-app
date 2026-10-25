import "server-only";
import { userClient } from "./supabase/server";
import { APP_URL, EMAIL_RE, norm } from "./data/store";

/*
 * Live build sign-in: Supabase Auth with email links (and Google once it's switched on in the
 * Supabase dashboard). One account per person; names come from the sign-up form.
 */

export const safeNext = (next: string | null | undefined) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
const callback = (next: string) => `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;

export type LinkResult = { ok: true; email: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Email a sign-in link. With names, it also creates the account if there isn't one. */
export async function sendSignInLink(input: { email: string; firstName?: string; lastName?: string; next?: string; create: boolean }): Promise<LinkResult> {
  const email = norm(input.email);
  const fieldErrors: Record<string, string> = {};
  if (input.create) {
    if (!input.firstName?.trim()) fieldErrors.firstName = "Add your first name.";
    if (!input.lastName?.trim()) fieldErrors.lastName = "Add your last name.";
  }
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter an email like name@gmail.com.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const sb = await userClient();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: input.create,
      emailRedirectTo: callback(input.next ?? "/"),
      data: input.create ? { first_name: input.firstName!.trim(), last_name: input.lastName!.trim() } : undefined,
    },
  });
  if (error) {
    if (/signups not allowed|user not found/i.test(error.message))
      return { ok: false, error: "There's no account with that email yet. Create one below.", fieldErrors: { email: "No account with this email yet. Create one below." } };
    if (/rate limit|security purposes/i.test(error.message)) return { ok: false, error: "We just sent you a link. Wait a minute before asking for another." };
    return { ok: false, error: "Couldn't send the link. Try again in a minute." };
  }
  return { ok: true, email };
}

export const googleEnabled = () => process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "1";

export async function googleSignInUrl(next: string): Promise<string | null> {
  const sb = await userClient();
  const { data, error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next), skipBrowserRedirect: true } });
  return error ? null : data.url;
}
