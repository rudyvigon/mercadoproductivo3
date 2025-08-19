import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { headers } from "next/headers";
import { Check, X, Image as ImageIcon, Package as PackageIcon, Coins, Sparkles, Infinity as InfinityIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Planes de Suscripción | Mercado Productivo",
  description: "Planes flexibles para emprendedores, PyMEs y empresas. Elige el plan perfecto para tu negocio.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanRow = {
  code: string;
  name: string | null;
  max_products: number | null;
  max_images_per_product: number | null;
  credits_monthly: number | null;
  can_feature?: boolean | null;
  feature_cost?: number | null;
  // Campos opcionales para precios (si existen en la BD)
  price_monthly_cents?: number | null;
  price_yearly_cents?: number | null;
  currency?: string | null;
  price_monthly?: number | null; // en unidades de moneda (no centavos)
  price_yearly?: number | null;  // en unidades de moneda (no centavos)
};

// Formateador de moneda seguro por servidor (AR: separador decimal "," y de miles ".")
const formatCurrency = (amount: number, currency: string = "ARS", locale: string = "es-AR") => {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    // Fallback manual para AR: separador miles "." y decimal ","
    const sign = amount < 0 ? "-" : "";
    const n = Math.abs(amount);
    const [intPart, decPart] = n.toFixed(2).split(".");
    const intWithThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${sign}${currency} ${intWithThousands},${decPart}`;
  }
};

// Cálculo de precios mensuales/anuales a partir de los campos disponibles
const computePrice = (p: PlanRow): { monthly: number | null; yearly: number | null; currency: string } => {
  const cur = (p.currency || "ARS").toUpperCase();
  let monthly: number | null = null;
  let yearly: number | null = null;

  if (typeof p.price_monthly_cents === "number") {
    monthly = p.price_monthly_cents / 100;
  } else if (p.price_monthly != null) {
    const m = Number((p.price_monthly as unknown) as any);
    monthly = Number.isFinite(m) ? m : null;
  }

  if (typeof p.price_yearly_cents === "number") {
    yearly = p.price_yearly_cents / 100;
  } else if (p.price_yearly != null) {
    const y = Number((p.price_yearly as unknown) as any);
    yearly = Number.isFinite(y) ? y : null;
  }

  // Derivar mensual/anual si falta alguno
  if (monthly == null && yearly != null) monthly = Number((yearly / 12).toFixed(2));
  if (yearly == null && monthly != null) yearly = Number((monthly * 12).toFixed(2));

  if (monthly != null) monthly = Number(monthly.toFixed(2));
  if (yearly != null) yearly = Number(yearly.toFixed(2));

  return { monthly, yearly, currency: cur };
};

// Helpers para identificar planes por tipo
const isFreePlan = (p: PlanRow) => {
  const code = (p.code || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  const { monthly } = computePrice(p);
  return (
    monthly === 0 ||
    code.includes("free") ||
    code.includes("basic") ||
    name.includes("básico") ||
    name.includes("basico")
  );
};

const isDeluxePlan = (p: PlanRow) => {
  const code = (p.code || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  return code.includes("deluxe") || name.includes("deluxe");
};

export default async function PlanesPage({ searchParams }: { searchParams?: { interval?: string } }) {
  // Consumir el endpoint interno que usa Service Role
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  let plans: PlanRow[] = [];
  let endpointError: string | null = null;
  try {
    const res = await fetch(`${baseUrl}/api/public/plans`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      plans = Array.isArray(json?.plans) ? json.plans : [];
    } else {
      let msg = `GET /api/public/plans status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.message) msg += ` - ${errJson.message}`;
        if (errJson?.error) msg += ` (${errJson.error})`;
      } catch {}
      endpointError = msg;
      console.error(msg);
    }
  } catch (e: any) {
    console.error("Error fetch /api/public/plans", e?.message || e);
    endpointError = e?.message || "Fallo de red";
  }
  // Intercambiar el orden de Deluxe y Gratis (si ambos existen)
  try {
    if (plans.length > 0) {
      const idxFree = plans.findIndex(isFreePlan);
      const idxDeluxe = plans.findIndex(isDeluxePlan);
      if (idxFree !== -1 && idxDeluxe !== -1 && idxFree !== idxDeluxe) {
        const copy = [...plans];
        const tmp = copy[idxFree];
        copy[idxFree] = copy[idxDeluxe];
        copy[idxDeluxe] = tmp;
        plans = copy;
      }
    }
  } catch {}
  const interval = searchParams?.interval === "yearly" ? "yearly" : "monthly";
  return (
    <main className="mx-auto max-w-6xl p-4 space-y-6 sm:p-6 sm:space-y-8">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Planes y Precios</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Planes flexibles diseñados para crecer contigo. Desde emprendedores hasta grandes empresas,
          tenemos la solución perfecta para tus necesidades.
        </p>
      </section>

      {/* Switch Mensual / Anual */}
      <section className="flex items-center justify-center">
        <div className="inline-flex gap-2 rounded-full bg-muted p-1">
          <Button asChild variant={interval === "monthly" ? "default" : "outline"} size="sm" className="rounded-full">
            <Link href="/planes?interval=monthly" prefetch={false}>Mensual</Link>
          </Button>
          <Button asChild variant={interval === "yearly" ? "default" : "outline"} size="sm" className="rounded-full">
            <Link href="/planes?interval=yearly" prefetch={false}>Anual</Link>
          </Button>
        </div>
      </section>

      {/* Plans */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, idx) => {
          const code = (p.code || "").toLowerCase();
          const label = p.name || p.code || "Plan";
          const maxProducts = p.max_products ?? null;
          const maxImages = p.max_images_per_product ?? null;
          const credits = p.credits_monthly ?? 0;
          const canFeature = Boolean(p.can_feature ?? true);
          const featureCost = typeof p.feature_cost === "number" ? p.feature_cost : (p.feature_cost ? Number(p.feature_cost) : null);
          const { monthly, yearly, currency } = computePrice(p);
          const monthlyFmt = monthly != null ? formatCurrency(monthly, currency) : null;
          const yearlyFmt = yearly != null ? formatCurrency(yearly, currency) : null;
          const isPopular = code === "plus" || /plus/i.test(label); // Heurística simple si no hay flag en BD
          const isFirst = idx === 0;
          const isSecond = idx === 1;
          const isThird = idx === 2;
          const btnVariant = isThird ? "default" : "outline";
          const btnClass =
            "w-full " +
            (isFirst
              ? "bg-white text-black hover:bg-white/90 "
              : isSecond
              ? "bg-white text-primary hover:bg-white/90 border-primary "
              : isThird
              ? "shadow-none hover:shadow-[0_0_24px_rgba(249,115,22,0.45)] transition-shadow "
              : "bg-white text-black hover:bg-white/90 ");
          return (
            <Card
              key={p.code}
              className={
                isPopular
                  ? "relative flex h-full flex-col overflow-hidden ring-1 ring-primary/50 border-primary/40 shadow-lg shadow-primary/10 transition hover:shadow-xl"
                  : "relative flex h-full flex-col overflow-hidden transition hover:shadow-md"
              }
            >
              {isPopular && (
                <div className="absolute top-3 right-3">
                  <Badge className="px-3 py-1" variant="default">Más Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">{label}</CardTitle>
                <CardDescription className="capitalize">{code}</CardDescription>
              </CardHeader>
              <CardContent className="grow">
                <div className="mb-3">
                  {(monthly != null || yearly != null) && (
                    <>
                      {interval === "yearly" ? (
                        <>
                          <div className="text-3xl font-bold">
                            {yearly != null && yearly === 0 ? (
                              "Gratis"
                            ) : (
                              <>
                                {yearlyFmt} <span className="text-sm text-muted-foreground">/año</span>
                              </>
                            )}
                          </div>
                          {monthly != null && (
                            <div className="text-xs text-muted-foreground">{monthly === 0 ? "o Gratis" : <>o {monthlyFmt} /mes</>}</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-3xl font-bold">
                            {monthly != null && monthly === 0 ? (
                              "Gratis"
                            ) : (
                              <>
                                {monthlyFmt} <span className="text-sm text-muted-foreground">/mes</span>
                              </>
                            )}
                          </div>
                          {yearly != null && (
                            <div className="text-xs text-muted-foreground">{yearly === 0 ? "o Gratis" : <>o {yearlyFmt} /año</>}</div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-1 space-y-3 text-sm">
                  <p className="font-medium">Incluye:</p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <PackageIcon className="h-4 w-4 text-primary" />
                      <span>{maxProducts ? `${maxProducts} producto(s) máximo` : "Productos ilimitados"}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span>{maxImages ?? "—"} imagen(es) por producto</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {credits > 0 ? (
                        <Coins className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-primary" />
                      )}
                      <span title="Créditos mensuales que puedes usar para acciones como destacar productos.">
                        {credits > 0 ? `${credits} crédito(s) mensuales` : "Sin créditos mensuales"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {canFeature ? (
                        <Sparkles className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-primary" />
                      )}
                      <span>
                        {canFeature
                          ? `Puede destacar productos${featureCost ? ` (costo ${featureCost})` : ""}`
                          : "No puede destacar productos"}
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="mt-auto">
                {isThird ? (
                  <Button
                    asChild
                    className="relative overflow-hidden group w-full bg-orange-500 text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                    variant="default"
                  >
                    <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(p.code)}&interval=${interval}`} prefetch={false}>
                      <span className="pointer-events-none absolute -left-20 top-0 h-full w-1/3 -skew-x-12 bg-white/30 transition-transform duration-500 group-hover:translate-x-[200%]"></span>
                      <span>Comienza con {label}</span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className={btnClass}
                    variant={btnVariant}
                  >
                    <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(p.code)}&interval=${interval}`} prefetch={false}>Comienza con {label}</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
        {(!plans || plans.length === 0) && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Planes no disponibles</CardTitle>
              <CardDescription>Configura la tabla <code>plans</code> en Supabase para verlos aquí.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>No encontramos planes para mostrar. Intenta más tarde.</p>
              {endpointError && (
                <p className="text-xs">Diagnóstico: {endpointError}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Comparador de planes */}
      {plans && plans.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Comparar planes</h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Característica</th>
                  {plans.map((p) => (
                    <th key={`h-${p.code}`} className="px-4 py-3 text-left font-medium">
                      {p.name || p.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
              <tr className="border-t odd:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">Precio mensual</td>
                  {plans.map((p) => {
                    const { monthly, currency } = computePrice(p);
                    return (
                      <td key={`r-price-${p.code}`} className="px-4 py-3">
                        {monthly == null ? "" : monthly === 0 ? "Gratis" : formatCurrency(monthly, currency)}
                      </td>
                    );
                  })}
                </tr>   <tr className="border-t odd:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">Precio Anual</td>
                  {plans.map((p) => {
                    const { yearly, currency } = computePrice(p);
                    return (
                      <td key={`r-price-${p.code}`} className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-primary">{yearly == null ? "" : yearly === 0 ? "Gratis" : formatCurrency(yearly, currency)}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t odd:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">Productos máximos</td>
                  {plans.map((p) => (
                    <td key={`r-prod-${p.code}`} className="px-4 py-3">
                      {p.max_products ? p.max_products : (
                        <span className="inline-flex items-center gap-1"><InfinityIcon className="h-4 w-4" /> Ilimitados</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t odd:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">Imágenes por producto</td>
                  {plans.map((p) => (
                    <td key={`r-img-${p.code}`} className="px-4 py-3">{p.max_images_per_product ?? "—"}</td>
                  ))}
                </tr>
                <tr className="border-t odd:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">Créditos mensuales</td>
                  {plans.map((p) => (
                    <td key={`r-cred-${p.code}`} className="px-4 py-3">{p.credits_monthly ?? 0}</td>
                  ))}
                </tr>
                <tr className="border-t odd:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">Puede destacar</td>
                  {plans.map((p) => (
                    <td key={`r-feat-${p.code}`} className="px-4 py-3">
                      {p.can_feature ? (
                        <span className="inline-flex items-center gap-1 text-primary"><Check className="h-4 w-4" /> Sí{typeof p.feature_cost === "number" ? ` (costo ${p.feature_cost})` : ""}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-primary"><X className="h-4 w-4" /> No</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto mt-16 max-w-6xl">
        <h2 className="text-2xl font-semibold tracking-tight">Preguntas Frecuentes</h2>
        <p className="mt-2 text-muted-foreground">Resolvemos las dudas más comunes sobre nuestros planes y servicios.</p>
        <Accordion type="single" collapsible className="mt-6">
          <AccordionItem value="q1">
            <AccordionTrigger>¿Puedo cambiar de plan en cualquier momento?</AccordionTrigger>
            <AccordionContent>
              Sí, puedes actualizar o degradar tu plan en cualquier momento desde tu panel de control. Los cambios se
              aplicarán en tu próximo ciclo de facturación.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger>¿Qué son los créditos mensuales?</AccordionTrigger>
            <AccordionContent>
              Los créditos te permiten destacar tus productos, aparecer en búsquedas prioritarias y acceder a funciones
              premium. Se renuevan cada mes según tu plan.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger>¿Hay descuentos por pago anual?</AccordionTrigger>
            <AccordionContent>
              Sí, en todos los planes pagados anualmente obtienes 2 meses gratis!
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger>¿Puedo cancelar mi suscripción?</AccordionTrigger>
            <AccordionContent>
              Por supuesto. Puedes cancelar tu suscripción en cualquier momento desde tu panel de control. Mantendrás
              acceso a las funciones premium hasta el final de tu período de facturación actual.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* CTA Final */}
      <section className="mx-auto mt-16 max-w-3xl rounded-xl border bg-muted/30 p-8 text-center">
        <h3 className="text-2xl font-semibold">¿Listo para hacer crecer tu negocio?</h3>
        <p className="mt-2 text-muted-foreground">
          Únete a miles de emprendedores que ya están vendiendo más con Mercado Productivo.
        </p>
        <div className="mt-3 flex items-baseline justify-center gap-x-2 sm:mt-4 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Publicar Ahora</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacto">Contáctanos</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
