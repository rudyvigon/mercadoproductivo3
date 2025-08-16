import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros | Mercado Productivo",
  description: "Conoce la misión y visión de Mercado Productivo",
};

export default function NosotrosPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Nosotros</h1>
      <p className="mt-3 text-muted-foreground">
        Conectamos vendedores y compradores B2B agroindustriales, facilitando contactos directos y sin comisiones.
      </p>
      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Nuestra misión</h2>
        <p>
          Impulsar la eficiencia y transparencia del comercio B2B mediante tecnología y una red confiable de actores del sector.
        </p>
      </section>
      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Nuestros valores</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Transparencia y confianza</li>
          <li>Eficiencia operativa</li>
          <li>Innovación y colaboración</li>
        </ul>
      </section>
    </main>
  );
}
