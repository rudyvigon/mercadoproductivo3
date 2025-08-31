import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Mercado Productivo",
  description: "Política de privacidad de Mercado Productivo",
};

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es-AR")}</p>

      <section className="prose prose-gray mt-8 max-w-none dark:prose-invert">
        <p>
          Esta es una versión preliminar de la Política de Privacidad de Mercado Productivo. El contenido puede
          actualizarse sin previo aviso y su propósito es informativo. Para más información, contáctanos a través
          de la página de contacto.
        </p>
        <h2>1. Datos recopilados</h2>
        <p>
          Recopilamos la información necesaria para brindar el servicio, mejorar la experiencia y garantizar la
          seguridad de la plataforma.
        </p>
        <h2>2. Uso de la información</h2>
        <p>
          Utilizamos los datos para facilitar el contacto entre vendedores y compradores, y para mantener la
          integridad del sistema.
        </p>
        <h2>3. Derechos de los usuarios</h2>
        <p>
          Puedes solicitar acceso, rectificación o eliminación de tus datos de acuerdo con la normativa vigente.
        </p>
      </section>
    </main>
  );
}
