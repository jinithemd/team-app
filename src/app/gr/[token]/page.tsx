import type { Metadata } from "next";
import { verify } from "@/lib/tokens";
import { GuestAutoAnswer } from "./auto";

export const metadata: Metadata = { title: "Your answer", robots: { index: false } };

/**
 * A guest player's one-tap answer from the email, no sign-in needed. Saved by the browser
 * after the page loads, so email scanners that pre-open links don't answer for them.
 */
export default async function GuestAnswerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = !!verify(token);
  return (
    <main className="gutter mx-auto grid min-h-dvh max-w-md content-center gap-4 py-12">
      {valid ? (
        <GuestAutoAnswer token={token} />
      ) : (
        <>
          <h1 className="text-xl font-bold">This link has expired</h1>
          <p className="text-muted">Ask the captain to send the game again.</p>
        </>
      )}
    </main>
  );
}
