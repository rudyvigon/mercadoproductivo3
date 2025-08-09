import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Planes | Mercado Productivo",
  description: "Planes y precios para anunciantes y empresas",
};

export default function PlanesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Planes</h1>
      <p className="mt-3 text-muted-foreground">
        Conoce nuestros planes pensados para diferentes necesidades del mercado B2B.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold">Básico</h3>
          <p className="mt-2 text-sm text-muted-foreground">Inicio ideal para publicar y recibir contactos.</p>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold">Profesional</h3>
          <p className="mt-2 text-sm text-muted-foreground">Mayor visibilidad y herramientas de gestión.</p>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold">Empresas</h3>
          <p className="mt-2 text-sm text-muted-foreground">Solución integral para equipos y grandes cuentas.</p>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        También puedes ver la sección destacada de la home en {""}
        <Link className="underline" href="/">Inicio</Link>.
      </p>
    </main>
  );
}
