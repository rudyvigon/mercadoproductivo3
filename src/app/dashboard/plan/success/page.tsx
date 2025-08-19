import Link from "next/link";
import { headers } from "next/headers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import PlanBadge from "@/components/badges/plan-badge";
import { CheckCircle2, CalendarDays, CreditCard, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getParam(v: string | string[] | undefined) {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

// Formateo de moneda robusto (AR por defecto)
function formatCurrency(amount: number, currency: string = "ARS", locale: string = "es-AR") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    const sign = amount < 0 ? "-" : "";
    const n = Math.abs(amount);
    const [intPart, decPart] = n.toFixed(2).split(".");
    const intWithThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${sign}${currency} ${intWithThousands},${decPart}`;
  }
}

// Cálculo de precios mensuales/anuales a partir de los campos disponibles
function computePrice(p: any): { monthly: number | null; yearly: number | null; currency: string } {
  const cur = (p?.currency || "ARS").toUpperCase();
  let monthly: number | null = null;
  let yearly: number | null = null;

  if (typeof p?.price_monthly_cents === "number") monthly = p.price_monthly_cents / 100;
  else if (p?.price_monthly != null) {
    const m = Number(p.price_monthly as any);
    monthly = Number.isFinite(m) ? m : null;
  }

  if (typeof p?.price_yearly_cents === "number") yearly = p.price_yearly_cents / 100;
  else if (p?.price_yearly != null) {
    const y = Number(p.price_yearly as any);
    yearly = Number.isFinite(y) ? y : null;
  }

  if (monthly == null && yearly != null) monthly = Number((yearly / 12).toFixed(2));
  if (yearly == null && monthly != null) yearly = Number((monthly * 12).toFixed(2));

  if (monthly != null) monthly = Number(monthly.toFixed(2));
  if (yearly != null) yearly = Number(yearly.toFixed(2));
  return { monthly, yearly, currency: cur };
}

function planLabelFromCode(code?: string | null, fallback?: string | null) {
  const c = String(code || "").toLowerCase();
  const map: Record<string, string> = {
    gratis: "Básico",
    free: "Básico",
    basic: "Básico",
    plus: "Plus",
    enterprise: "Plus",
    deluxe: "Deluxe",
    diamond: "Deluxe",
    premium: "Plus",
    pro: "Plus",
  };
  return map[c] ?? fallback ?? code ?? "Básico";
}

type Props = { searchParams?: Record<string, string | string[] | undefined> };

export default async function SuccessPage({ searchParams }: Props) {
  const preapprovalId = getParam(searchParams?.preapproval_id) || getParam(searchParams?.id);
  const created = getParam(searchParams?.created) === "1";
  const scheduled = getParam(searchParams?.scheduled) === "1";
  const already = getParam(searchParams?.already) === "1";
  const free = getParam(searchParams?.free) === "1";
  const effectiveAt = getParam(searchParams?.effective_at);

  // Disparar procesamiento del preapproval en nuestro backend (idempotente)
  if (preapprovalId) {
    const baseUrl = getBaseUrl();
    try {
      await fetch(`${baseUrl}/api/webhooks/mercadopago?id=${encodeURIComponent(preapprovalId)}`, {
        method: "GET",
        cache: "no-store",
      });
    } catch {
      // Ignorar: el webhook real de MP actualizará el estado igualmente
    }
  }

  let description: JSX.Element | string = "Suscripción completada correctamente.";
  if (free) description = "Tu plan gratuito fue activado exitosamente.";
  else if (created) description = "Suscripción creada. En breve se confirmará y se actualizará tu plan.";
  else if (scheduled)
    description = effectiveAt
      ? `Cambio de plan programado para ${new Date(effectiveAt).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}.`
      : "Cambio de plan programado para el próximo ciclo.";
  else if (already) description = "Ya estabas suscripto a este plan.";

  // Cargar perfil para mostrar plan activo/pendiente
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let activeCode: string | null = null;
  let pendingCode: string | null = null;
  let pendingEffectiveAt: string | null = null;
  let renewsAt: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_code, plan_pending_code, plan_pending_effective_at, plan_renews_at")
      .eq("id", user.id)
      .maybeSingle();
    activeCode = (profile as any)?.plan_code ?? null;
    pendingCode = (profile as any)?.plan_pending_code ?? null;
    pendingEffectiveAt = (profile as any)?.plan_pending_effective_at ?? null;
    renewsAt = (profile as any)?.plan_renews_at ?? null;
  }

  // Obtener lista de planes (para nombres y precios)
  const baseUrl = getBaseUrl();
  let plans: any[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/public/plans`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      plans = Array.isArray(json?.plans) ? json.plans : [];
    }
  } catch {}

  const findPlan = (code?: string | null) => {
    if (!code) return null;
    const lc = String(code).toLowerCase();
    return plans.find((p: any) => String(p?.code || "").toLowerCase() === lc) || null;
  };
  const activePlan = findPlan(activeCode);
  const pendingPlan = findPlan(pendingCode);
  const activeLabel = planLabelFromCode(activeCode, activePlan?.name || activePlan?.code || null);
  const pendingLabel = planLabelFromCode(pendingCode, pendingPlan?.name || pendingPlan?.code || null);
  const activePrices = activePlan ? computePrice(activePlan) : { monthly: null, yearly: null, currency: "ARS" };
  const pendingPrices = pendingPlan ? computePrice(pendingPlan) : { monthly: null, yearly: null, currency: "ARS" };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Hero de agradecimiento */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-50 via-orange-100/60 to-white">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-orange-200 blur-3xl opacity-40" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-200 blur-3xl opacity-40" />
        <div className="relative grid gap-6 p-6 sm:p-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm font-medium text-orange-700 ring-1 ring-orange-200">
              <CheckCircle2 className="h-4 w-4" />
              ¡Gracias por suscribirte!
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Tu suscripción está en marcha</h1>
            <p className="mt-2 text-muted-foreground">{description}</p>
            {preapprovalId && (
              <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" /> ID de autorización: <span className="font-medium">{preapprovalId}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/dashboard/plan">Ir a Mi Plan</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Ir al Dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/planes" prefetch={false}>
                  Ver otros planes
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          {/* Mockup/Ilustración */}
          <div className="relative order-first md:order-last">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-white shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?q=80&w=1200&auto=format&fit=crop"
                alt="Celebración de suscripción"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="pointer-events-none absolute -bottom-3 left-1/2 h-20 w-[80%] -translate-x-1/2 rounded-full bg-orange-200/50 blur-2xl" />
          </div>
        </div>
      </section>

      {/* Resumen del plan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Resumen de tu suscripción</CardTitle>
              <CardDescription>Estado actual y próximos pasos</CardDescription>
            </div>
            <PlanBadge planCode={activeCode || undefined} planLabel={activeLabel} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border p-4">
            <div className="text-muted-foreground">Plan actual</div>
            <div className="font-medium">{activeLabel}</div>
            {activePrices.monthly != null && (
              <div className="mt-1 text-sm text-muted-foreground">
                {activePrices.monthly === 0 ? (
                  <>Gratis</>
                ) : (
                  <>
                    {formatCurrency(activePrices.monthly, activePrices.currency)} <span className="text-xs">/mes</span>
                  </>
                )}
              </div>
            )}
            {renewsAt && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Renueva: {new Date(renewsAt).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            )}
          </div>

          <div className="rounded-md border p-4">
            <div className="text-muted-foreground">Próximo cambio</div>
            {pendingCode ? (
              <>
                <div className="font-medium">{pendingLabel}</div>
                {pendingPrices.monthly != null && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {pendingPrices.monthly === 0 ? (
                      <>Gratis</>
                    ) : (
                      <>
                        {formatCurrency(pendingPrices.monthly, pendingPrices.currency)} <span className="text-xs">/mes</span>
                      </>
                    )}
                  </div>
                )}
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(pendingEffectiveAt || effectiveAt || Date.now()).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </>
            ) : (
              <div className="font-medium">Sin cambios programados</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

