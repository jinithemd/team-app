// Shown the moment a screen opens, while the person's data loads.
export default function Loading() {
  const bar = "animate-pulse rounded-md bg-sunken";
  return (
    <main id="main" className="gutter mx-auto grid max-w-3xl gap-6 py-6" aria-busy="true">
      <span className="sr-only" role="status">Loading…</span>
      <div className="flex items-center gap-3.5">
        <div className="size-16 shrink-0 animate-pulse rounded-pill bg-sunken" />
        <div className="grid flex-1 gap-2">
          <div className={`${bar} h-5 w-2/5`} />
          <div className={`${bar} h-4 w-3/5`} />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-3 rounded-lg border border-border p-4">
          <div className={`${bar} h-4 w-1/3`} />
          <div className={`${bar} h-12 w-full`} />
        </div>
      ))}
    </main>
  );
}
