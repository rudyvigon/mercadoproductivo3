"use client";

export default function CatalogError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="container mx-auto p-4">
      <h2 className="text-lg font-semibold">Ocurrió un error al cargar el catálogo</h2>
      <pre className="mt-2 text-xs bg-red-950/30 text-red-200 p-2 rounded whitespace-pre-wrap">
        {error.message}
      </pre>
    </div>
  );
}
