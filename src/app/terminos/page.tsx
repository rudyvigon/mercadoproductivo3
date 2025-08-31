import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones | Mercado Productivo",
  description: "Términos y condiciones de uso de Mercado Productivo",
};

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Términos y Condiciones</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es-AR")}</p>

      <section className="prose prose-gray mt-8 max-w-none dark:prose-invert">
        <p>
          Este documento es una versión preliminar de los Términos y Condiciones de Mercado Productivo. Su
          propósito es informativo y puede ser actualizado sin previo aviso. Para más información, contáctanos a
          través de la página de contacto.
        </p>
        <h2>1. Uso del servicio</h2>
        <p>
          El uso de la plataforma implica la aceptación de estos términos. Los usuarios se comprometen a
          proporcionar información veraz y a utilizar el servicio de manera responsable.
        </p>
        <h2>2. Publicaciones y contacto</h2>
        <p>
          Los anuncios, productos y mensajes enviados dentro de la plataforma deben cumplir con la normativa
          vigente y las buenas prácticas comerciales.
        </p>
        <h2>3. Responsabilidad</h2>
        <p>
          Mercado Productivo actúa como facilitador de contactos B2B. No participa como contraparte directa en
          las operaciones entre usuarios.
        </p>
      </section>
    </main>
  );
}
