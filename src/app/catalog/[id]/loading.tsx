export default function LoadingCatalogDetail() {
  return (
    <div className="container mx-auto p-4 animate-pulse space-y-3">
      <div className="h-6 w-64 bg-muted rounded" />
      <div className="h-4 w-2/3 bg-muted rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="aspect-video bg-muted rounded" />
        <div className="aspect-video bg-muted rounded" />
        <div className="aspect-video bg-muted rounded" />
        <div className="aspect-video bg-muted rounded" />
      </div>
    </div>
  );
}
