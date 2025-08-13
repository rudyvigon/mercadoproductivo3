export default function LoadingCatalog() {
    return (
      <main className="container mx-auto p-6 animate-pulse space-y-6">
        {/* Título y filtros */}
        <div className="space-y-3">
          <div className="h-7 w-44 bg-muted rounded" />
          <div className="flex flex-wrap gap-3">
            <div className="h-9 w-40 bg-muted rounded" />
            <div className="h-9 w-40 bg-muted rounded" />
            <div className="h-9 w-24 bg-muted rounded" />
          </div>
        </div>

        {/* Grid de tarjetas */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="h-40 w-full bg-muted rounded" />
              <div className="h-5 w-3/5 bg-muted rounded" />
              <div className="h-4 w-4/5 bg-muted rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-muted rounded" />
                <div className="h-8 w-24 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }
