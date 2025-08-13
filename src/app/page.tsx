import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { ShieldCheck, BarChart3, Users, Search, Megaphone, MessageSquare } from "lucide-react";
import Reveal from "@/components/ui/reveal";
import TiltCard from "@/components/ui/tilt-card";

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2070&auto=format&fit=crop"
            alt="Cosecha en campo"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-white sm:px-6 sm:py-28 lg:py-32">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur-sm sm:text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Conexiones B2B agroindustriales
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Negocios directos entre empresas y productores
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/90 sm:text-base lg:text-lg">
            Eliminamos intermediarios innecesarios para reducir costos y tiempos. Transparencia, trazabilidad y contacto directo para acuerdos eficientes.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row">
            {!session && (
              <Link href="/auth/register" className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:opacity-95">
                Crear cuenta gratis
              </Link>
            )}
            <Link href="/catalog" className="inline-flex w-full items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20 sm:w-auto">
              Explorar catálogo
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:py-16 scroll-mt-24">
        <h2 className="text-center text-xl font-bold sm:text-2xl lg:text-3xl">¿Cómo funciona?</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
          Tres pasos simples para activar tus conexiones de negocio.
        </p>
        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Reveal direction="up" delayMs={0}>
            <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 w-fit rounded-md bg-emerald-100 p-2 text-emerald-700"><Search className="h-5 w-5" /></div>
              <h3 className="text-sm font-semibold sm:text-base">Explora y descubre</h3>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Busca por categoría o palabra clave y encuentra proveedores o clientes potenciales.</p>
            </div>
          </Reveal>
          <Reveal direction="up" delayMs={80}>
            <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 w-fit rounded-md bg-orange-100 p-2 text-orange-700"><Megaphone className="h-5 w-5" /></div>
              <h3 className="text-sm font-semibold sm:text-base">Publica tus anuncios</h3>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Crea publicaciones claras con fotos, especificaciones y disponibilidad.</p>
            </div>
          </Reveal>
          <Reveal direction="up" delayMs={160}>
            <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 w-fit rounded-md bg-sky-100 p-2 text-sky-700"><MessageSquare className="h-5 w-5" /></div>
              <h3 className="text-sm font-semibold sm:text-base">Contacta de forma directa</h3>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Concreta acuerdos por los canales de contacto del anunciante, sin comisiones por transacción.</p>
            </div>
          </Reveal>
          <Reveal direction="up" delayMs={240}>
            <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 w-fit rounded-md bg-emerald-100 p-2 text-emerald-700">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold sm:text-base">Conexiones directas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Negocia sin intermediación excesiva para mejorar márgenes y tiempos.
              </p>
            </div>
          </Reveal>
          <Reveal direction="up" delayMs={320}>
            <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 w-fit rounded-md bg-indigo-100 p-2 text-indigo-700">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold sm:text-base">Precios transparentes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Datos de mercado y comparativas en tiempo real para negociar mejor.
              </p>
            </div>
          </Reveal>
          <Reveal direction="up" delayMs={400}>
            <div className="rounded-lg border bg-background p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 w-fit rounded-md bg-rose-100 p-2 text-rose-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold sm:text-base">Perfiles verificados</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Verificación y reputación para construir relaciones comerciales duraderas.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Categorías destacadas */}
      <section id="categories" className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 scroll-mt-24">
        <h2 className="text-center text-xl font-bold sm:text-2xl lg:text-3xl">Explora categorías</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
          Desde commodities hasta productos frescos, encuentra lo que necesitas para tu negocio.
        </p>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Granos y Cereales",
              img: "https://images.unsplash.com/photo-1500937386664-56a5bf1724d2?q=80&w=2070&auto=format&fit=crop",
            },
            {
              title: "Frutas y Verduras",
              img: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2069&auto=format&fit=crop",
            },
            {
              title: "Carnes y Lácteos",
              img: "https://images.unsplash.com/photo-1505575972945-280ebd2b1904?q=80&w=2070&auto=format&fit=crop",
            },
            {
              title: "Insumos y Fertilizantes",
              img: "https://images.unsplash.com/photo-1592982537447-7440770cbfc8?q=80&w=2070&auto=format&fit=crop",
            },
          ].map((cat, i) => (
            <Reveal key={cat.title} direction="up" delayMs={i * 80}>
              <TiltCard className="group relative overflow-hidden rounded-lg border">
                <Link href="/catalog" className="block">
                  <div className="relative h-32 sm:h-40 lg:h-44">
                    <Image src={cat.img} alt={cat.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-xs font-semibold sm:text-sm">{cat.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Ver productos</p>
                  </div>
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA final */}
      {!session && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="rounded-xl border bg-muted/30 p-6 text-center sm:p-8 lg:p-10">
            <h3 className="text-lg font-semibold sm:text-xl lg:text-2xl">Impulsa tu negocio agroindustrial hoy</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Únete gratis, publica tus productos o encuentra proveedores confiables en minutos.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/auth/register" className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:opacity-95">
                Comenzar ahora
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
