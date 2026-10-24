import type { Metadata } from "next";
import { verify } from "@/lib/tokens";
import { AutoRsvp } from "./auto-rsvp";

export const metadata: Metadata = { title: "Your answer", robots: { index: false } };

/**
 * One-tap answer from an email button, no sign-in needed.
 * The answer is saved by the browser after the page loads (not on the GET itself),
 * so email security scanners that pre-open links don't answer for families.
 */
export default async function RsvpLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = !!verify(token);
  return (
    <main className="gutter mx-auto grid min-h-dvh max-w-md content-center gap-4 py-12">
      {valid ? (
        <AutoRsvp token={token} />
      ) : (
        <>
          <h1 className="text-xl font-bold">This link has expired</h1>
          <p className="text-muted">Open the app to answer instead.</p>
          <a href="/login" className="font-semibold text-team-ink underline">
            Open the app
          </a>
        </>
      )}
    </main>
  );
}
