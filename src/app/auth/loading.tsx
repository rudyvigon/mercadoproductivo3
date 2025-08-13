export default function LoadingAuth() {
  return (
    <main className="mx-auto max-w-md p-6 animate-pulse">
      <div className="space-y-2 text-center mb-6">
        <div className="mx-auto h-8 w-48 bg-muted rounded" />
        <div className="mx-auto h-4 w-64 bg-muted rounded" />
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-9 w-full bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-9 w-full bg-muted rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="flex justify-end">
          <div className="h-9 w-28 bg-muted rounded" />
        </div>
      </div>
    </main>
  );
}
