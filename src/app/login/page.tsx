import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSessionUser, listDemoAccounts } from "@/lib/data";
import { googleSignInAction, signInAsAction } from "../actions";
import { APP_NAME, APP_TAGLINE, MIN_AGE } from "@/lib/brand";
import { LIVE } from "@/lib/mode";
import { googleEnabled, safeNext } from "@/lib/auth";
import { Banner, buttonClass } from "@/components/ui";
import { SignInForm, SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string; google?: string; deleted?: string }> }) {
  const { next, expired, google, deleted } = await searchParams;
  if (await getSessionUser()) redirect(safeNext(next));
  const accounts = LIVE ? [] : await listDemoAccounts();
  // Google doesn't allow its sign-in inside apps' web views, so the phone app uses the email code.
  const inApp = ((await headers()).get("user-agent") ?? "").includes("ClbxApp");
  return (
    <main className="gutter min-h-dvh bg-surface py-10">
      <div className="mx-auto grid max-w-md grid-cols-1 gap-6">
        <div>
          {/* The official wordmark sits on its own dark tile so it reads in light and dark mode. */}
          <h1 className="m-0 inline-flex rounded-lg bg-[#06080D] px-5 py-4">
            <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-8 w-auto" />
          </h1>
          <p className="mt-2 text-muted">{APP_TAGLINE}</p>
        </div>
        {deleted && <Banner>Your account and personal data have been deleted. Thanks for using {APP_NAME}.</Banner>}
        {expired && <Banner tone="warning">That sign-in link has expired or was already used. Ask for a new one below.</Banner>}
        {google && <Banner tone="warning">Google sign-in isn&apos;t switched on yet. Use your email instead.</Banner>}

        {LIVE ? (
          <section aria-labelledby="signin-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
            <div>
              <h2 id="signin-h" className="text-lg font-semibold">
                Sign in
              </h2>
              <p className="text-sm text-muted">No password. We email you a link that signs you in.</p>
            </div>
            <SignInForm next={next} />
            {googleEnabled() && !inApp && (
              <form action={googleSignInAction}>
                <input type="hidden" name="next" value={next ?? ""} />
                <button className={buttonClass("secondary", "lg", "w-full")}>Continue with Google</button>
                <p className="mt-2 text-xs text-muted">
                  New to {APP_NAME}? Continuing with Google means you&apos;re {MIN_AGE} or older and agree to the terms and privacy policy.
                </p>
              </form>
            )}
          </section>
        ) : (
          <section aria-labelledby="demo-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
            <div>
              <h2 id="demo-h" className="text-lg font-semibold">
                Try it as someone on a team
              </h2>
              <p className="text-sm text-muted">Sample accounts. Dan owns a club and plays for, captains and manages one of its teams.</p>
            </div>
            <ul className="grid grid-cols-1 gap-2">
              {accounts.map((a) => (
                <li key={a.id}>
                  <form action={signInAsAction}>
                    <input type="hidden" name="userId" value={a.id} />
                    <input type="hidden" name="next" value={next ?? ""} />
                    <button className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border bg-bg px-3 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{a.name}</span>
                        <span className="block truncate text-sm text-muted">{a.blurb}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 text-muted" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="new-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
          <h2 id="new-h" className="text-lg font-semibold">
            New here? Create your account
          </h2>
          <SignUpForm next={next} />
          {!LIVE && (
            <Banner>
              Sample-data build: accounts are saved only until the server restarts, and no real emails are sent. Sent emails show up in{" "}
              <a className="font-semibold text-team-ink underline" href="/dev/outbox">
                the sample inbox
              </a>
              .
            </Banner>
          )}
        </section>
        <p className="text-center text-xs text-muted">
          <a href="/terms" className="underline">
            Terms
          </a>{" "}
          ·{" "}
          <a href="/privacy" className="underline">
            Privacy
          </a>
        </p>
      </div>
    </main>
  );
}
