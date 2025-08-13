export default function CatalogPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold sm:text-2xl lg:text-3xl">Catálogo</h1>
      <p className="text-sm text-muted-foreground sm:text-base">Busca y filtra anuncios. (Placeholder)</p>
      <pre className="mt-4 text-xs bg-muted/30 p-3 rounded sm:p-4 sm:text-sm">
        {JSON.stringify(searchParams ?? {}, null, 2)}
      </pre>
    </main>
  );
}
