import Link from "next/link";

export default function NotFound() {
  return (
    <main className="gutter mx-auto grid max-w-md gap-3 py-16">
      <h1 className="text-xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-muted">It may have been removed, or you might not be on that team.</p>
      <Link href="/" className="font-semibold text-team-ink underline">
        Go to Home
      </Link>
    </main>
  );
}
