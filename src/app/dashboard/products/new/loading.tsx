export default function LoadingNewProduct() {
  return (
    <main className="mx-auto max-w-5xl p-6 animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-52 bg-muted rounded" />
        <div className="h-9 w-32 bg-muted rounded" />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-9 w-full bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-9 w-full bg-muted rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-24 w-full bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-9 w-full bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-9 w-full bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-9 w-full bg-muted rounded" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <div className="h-9 w-28 bg-muted rounded" />
          <div className="h-9 w-28 bg-muted rounded" />
        </div>
      </div>
    </main>
  );
}
