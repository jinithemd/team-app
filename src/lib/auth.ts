import "server-only";
import { userClient } from "./supabase/server";
import { APP_URL, EMAIL_RE, norm } from "./data/store";
import { APP_NAME, TERMS_VERSION } from "./brand";

/*
 * Live build sign-in: Supabase Auth with email links (and Google once it's switched on in the
 * Supabase dashboard). One account per person; names come from the sign-up form.
 */

export const safeNext = (next: string | null | undefined) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
const callback = (next: string) => `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;

export type LinkResult = { ok: true; email: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/*
 * Sign-in emails are made here and sent through Resend, not by Supabase's own mailer.
 * The link carries a token hash that the server swaps for a session (/auth/callback), so it
 * works in any browser or app, on any device: the old link needed the browser that asked for
 * it, and failed when opened from a mail app. The email also has a code (6-10 digits) to type in
 * on the page that asked for it.
 */
async function throttle(email: string): Promise<boolean> {
  // One email a minute per address: a unique row per address per minute in the outbox.
  const { adminClient } = await import("./supabase/server");
  const minute = Math.floor(Date.now() / 60_000);
  const { error } = await (adminClient() as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("outbox")
    .insert({ kind: "signin", channel: "email", user_id: null, payload: { email }, dedupe_key: `signin:${email}:${minute}`, status: "sent" });
  return !error;
}

/** Email a sign-in link and code. With names, it also creates the account if there isn't one. */
export async function sendSignInLink(input: { email: string; firstName?: string; lastName?: string; next?: string; create: boolean; agreed?: boolean }): Promise<LinkResult> {
  const email = norm(input.email);
  const fieldErrors: Record<string, string> = {};
  if (input.create) {
    if (!input.firstName?.trim()) fieldErrors.firstName = "Add your first name.";
    if (!input.lastName?.trim()) fieldErrors.lastName = "Add your last name.";
  }
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter an email like name@gmail.com.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  const { adminClient } = await import("./supabase/server");
  const admin = adminClient();
  const { data: existing } = await admin.from("profiles").select("id, first_name").eq("email", email).maybeSingle();
  if (!existing && !input.create)
    return { ok: false, error: "There's no account with that email yet. Create one below.", fieldErrors: { email: "No account with this email yet. Create one below." } };
  if (!(await throttle(email))) return { ok: false, error: "We just sent you an email. Wait a minute before asking for another." };

  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        first_name: input.firstName!.trim(),
        last_name: input.lastName!.trim(),
        // When they confirmed 16+ and agreed to the terms and privacy policy.
        terms_accepted_at: input.agreed ? new Date().toISOString() : null,
        terms_version: TERMS_VERSION,
      },
    });
    if (error && !/already|registered|exists/i.test(error.message)) {
      console.error("[auth] create user:", error.message);
      return { ok: false, error: "Couldn't create your account. Try again in a minute." };
    }
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const props = data?.properties;
  if (error || !props?.hashed_token) {
    console.error("[auth] generate link:", error?.message);
    return { ok: false, error: "Couldn't send the email. Try again in a minute." };
  }
  const next = safeNext(input.next ?? "/");
  const link = `${APP_URL}/auth/callback?token_hash=${encodeURIComponent(props.hashed_token)}&type=${encodeURIComponent(props.verification_type || "magiclink")}&next=${encodeURIComponent(next)}`;
  const code = props.email_otp;
  const name = existing?.first_name ?? input.firstName?.trim();
  try {
    const { sendEmail } = await import("./email/worker");
    const { emailHtml, emailText } = await import("./email/template");
    const mail = {
      subject: code ? `${code} is your ${APP_NAME} sign-in code` : `Sign in to ${APP_NAME}`,
      text: [
        `Hi${name ? ` ${name}` : ""},`,
        `Tap the button to sign in to ${APP_NAME}. It works on any phone or computer, once, within an hour.`,
        code ? `Or type this code on the sign-in page: ${code}` : "",
        `Didn't ask for this? You can ignore this email; nobody can sign in without it.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      links: [{ label: "Sign in", href: link }],
    };
    await sendEmail({ to: email, subject: mail.subject, html: emailHtml(mail), text: emailText(mail) });
  } catch (e) {
    console.error("[auth] send:", (e as Error).message);
    return { ok: false, error: "Couldn't send the email. Try again in a minute." };
  }
  return { ok: true, email };
}

/** The code from the email (6-10 digits, as the project is set), typed on the page that asked for it. */
export async function verifySignInCode(emailRaw: string, codeRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = norm(emailRaw);
  const token = codeRaw.replace(/\D/g, "");
  if (!EMAIL_RE.test(email) || token.length < 6 || token.length > 10) return { ok: false, error: "Enter the code from the email." };
  const sb = await userClient();
  for (const type of ["email", "magiclink"] as const) {
    const { error } = await sb.auth.verifyOtp({ email, token, type });
    if (!error) return { ok: true };
    if (!/invalid|expired|not found/i.test(error.message)) {
      console.error("[auth] verify code:", error.message);
      break;
    }
  }
  return { ok: false, error: "That code didn't work. Check it, or ask for a new email." };
}

export const googleEnabled = () => process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "1";

export async function googleSignInUrl(next: string): Promise<string | null> {
  const sb = await userClient();
  const { data, error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next), skipBrowserRedirect: true } });
  return error ? null : data.url;
}
