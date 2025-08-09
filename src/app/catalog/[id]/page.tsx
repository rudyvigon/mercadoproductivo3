import Link from "next/link";

export default function CatalogDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <main className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Detalle de anuncio #{id}</h1>
        <p className="text-sm text-muted-foreground">Vista de detalle (Placeholder)</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Contacto</h2>
        <div className="flex gap-3">
          <Link href="#" className="text-primary underline-offset-4 hover:underline" prefetch={false}>WhatsApp</Link>
          <Link href="#" className="text-primary underline-offset-4 hover:underline" prefetch={false}>Llamar</Link>
          <Link href="#" className="text-primary underline-offset-4 hover:underline" prefetch={false}>Email</Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Imágenes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="aspect-video bg-muted rounded" />
          <div className="aspect-video bg-muted rounded" />
          <div className="aspect-video bg-muted rounded" />
          <div className="aspect-video bg-muted rounded" />
        </div>
      </section>
    </main>
  );
}
