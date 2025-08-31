import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros | Mercado Productivo",
  description: "Conoce la misión y visión de Mercado Productivo",
};

export default function NosotrosPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Nosotros</h1>
        <p className="max-w-prose text-muted-foreground">
          Conectamos vendedores y compradores B2B agroindustriales con foco en transparencia y contacto directo.
        </p>
      </div>

      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Nuestra misión</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Impulsar la eficiencia del comercio B2B mediante tecnología y una red confiable de actores del sector.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Nuestra visión</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ser la plataforma de referencia para conectar a la agroindustria latinoamericana con el mundo.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Nuestro equipo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Equipo multidisciplinario con foco en producto, datos y agro.
        </p>
      </section>
    </main>
  );
}
