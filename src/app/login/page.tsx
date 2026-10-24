import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSessionUser, listDemoAccounts } from "@/lib/data";
import { signInAsAction } from "../actions";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { Banner } from "@/components/ui";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { next } = await searchParams;
  const accounts = await listDemoAccounts();
  return (
    <main className="gutter min-h-dvh bg-surface py-10">
      <div className="mx-auto grid max-w-md grid-cols-1 gap-6">
        <div>
          <p className="font-display text-display leading-none font-bold uppercase">{APP_NAME}</p>
          <p className="mt-2 text-muted">{APP_TAGLINE}</p>
        </div>

        <section aria-labelledby="demo-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
          <div>
            <h1 id="demo-h" className="text-lg font-semibold">
              Try it as someone on a team
            </h1>
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

        <section aria-labelledby="new-h" className="grid gap-3 rounded-lg border border-border bg-bg p-4">
          <h2 id="new-h" className="text-lg font-semibold">
            New here? Create your account
          </h2>
          <SignUpForm next={next} />
          <Banner>
            Sample-data build: accounts are saved only until the server restarts, and no real emails are sent. Sent emails show up in{" "}
            <a className="font-semibold text-team-ink underline" href="/dev/outbox">
              the sample inbox
            </a>
            .
          </Banner>
        </section>
      </div>
    </main>
  );
}
