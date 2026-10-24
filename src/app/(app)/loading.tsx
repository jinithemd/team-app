export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="gutter mx-auto grid max-w-3xl gap-3 py-6">
      <div className="skeleton h-7 w-48 rounded-md" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-4">
          <div className="skeleton h-3 w-2/5 rounded-md" />
          <div className="skeleton h-3 w-4/5 rounded-md" />
          <div className="skeleton h-3 w-3/5 rounded-md" />
        </div>
      ))}
    </div>
  );
}
