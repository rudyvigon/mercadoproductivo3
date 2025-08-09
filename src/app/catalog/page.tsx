export default function CatalogPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold">Catálogo</h1>
      <p className="text-sm text-muted-foreground">Busca y filtra anuncios. (Placeholder)</p>
      <pre className="mt-4 text-xs bg-muted/30 p-2 rounded">
        {JSON.stringify(searchParams ?? {}, null, 2)}
      </pre>
    </main>
  );
}
