"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="gutter mx-auto grid max-w-md gap-3 py-16">
      <h1 className="text-xl font-bold">Something went wrong loading this</h1>
      <p className="text-muted">Check your connection and try again.</p>
      <button onClick={reset} className="min-h-11 justify-self-start rounded-md bg-team px-4 text-sm font-semibold text-on-team">
        Try again
      </button>
    </div>
  );
}
