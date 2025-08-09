export default function LoadingCatalog() {
  return (
    <div className="container mx-auto p-4 animate-pulse">
      <div className="h-6 w-40 bg-muted rounded" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    </div>
  );
}
