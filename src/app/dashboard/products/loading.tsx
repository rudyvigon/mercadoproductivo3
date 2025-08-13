export default function LoadingProducts() {
    return (
      <main className="mx-auto max-w-5xl p-6 animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 bg-muted rounded" />
          <div className="h-9 w-36 bg-muted rounded" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="h-5 w-2/3 bg-muted rounded" />
              <div className="h-4 w-4/5 bg-muted rounded" />
              <div className="h-24 w-full bg-muted rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-muted rounded" />
                <div className="h-8 w-20 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }
