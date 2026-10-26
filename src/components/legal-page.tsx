import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";

/** Shared frame for the privacy policy and terms: readable on a phone, no sign-in needed. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="gutter min-h-dvh bg-bg py-10">
      <article className="mx-auto grid max-w-2xl gap-5 text-[15px] leading-relaxed [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-team-ink [&_a]:underline">
        <Link href="/" className="inline-flex justify-self-start rounded-md bg-[#06080D] px-3.5 py-2.5 no-underline">
          <img src="/clbx-logo.png" alt={APP_NAME} width={1077} height={177} className="h-5 w-auto" />
        </Link>
        <header>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">Last updated {updated}</p>
        </header>
        {children}
        <footer className="mt-6 border-t border-border pt-4 text-sm text-muted">
          <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms</Link>
        </footer>
      </article>
    </main>
  );
}
