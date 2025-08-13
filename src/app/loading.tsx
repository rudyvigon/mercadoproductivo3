export default function GlobalAppLoading() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-80 bg-muted rounded" />
      </div>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="h-5 w-1/2 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
            <div className="h-24 w-full bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-muted rounded" />
              <div className="h-9 w-24 bg-muted rounded" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
