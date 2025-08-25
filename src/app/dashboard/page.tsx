import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { UsageRadial, CountdownUntil } from "@/components/dashboard/kpi-charts";
import PlanBadge from "@/components/badges/plan-badge";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Nombre para saludo
  const firstNameFromMeta = (user.user_metadata?.first_name || user.user_metadata?.firstName || user.user_metadata?.full_name || "").toString().split(" ")[0];
  const emailVerified = Boolean(user.email_confirmed_at);
  const role = (user.user_metadata?.role || "").toString();
  // Normalizar rol legacy a estándar
  const roleNormalized = role === "anunciante" ? "seller" : role;
  // Plan: preferir DB (profiles.plan_code); metadata como fallback
  const metaPlan = (user.user_metadata?.plan || user.user_metadata?.plan_code || "").toString();
  let planRaw = "";

  // Traer perfil y determinar campos requeridos para publicar
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, dni_cuit, company, address, city, province, postal_code, plan_code, updated_at")
    .eq("id", user.id)
    .single();

  planRaw = (profile?.plan_code || "").toString() || metaPlan;
  const planMap: Record<string, string> = {
    free: "Básico",
    basic: "Básico",
    plus: "Plus",
    enterprise: "Plus",
    deluxe: "Deluxe",
    diamond: "Deluxe",
    premium: "Plus",
    pro: "Plus",
  };
  let planLabel = planRaw ? (planMap[planRaw.toLowerCase()] ?? (planRaw.charAt(0).toUpperCase() + planRaw.slice(1))) : "—";
  if (planLabel === "—" && roleNormalized === "seller") {
    // Fallback visual: si es vendedor pero aún no tiene plan_code, mostrar Básico
    planLabel = "Básico";
  }

  const p_first = (profile?.first_name ?? user.user_metadata?.first_name ?? "").toString();
  const p_last = (profile?.last_name ?? user.user_metadata?.last_name ?? "").toString();
  const full_name = (profile?.full_name ?? `${p_first} ${p_last}`).toString().trim();
  const p_email = (user.email ?? "").toString();
  const p_dni_cuit = (profile?.dni_cuit ?? "").toString();
  const p_company = (profile?.company ?? "").toString();
  const p_address = (profile?.address ?? "").toString();
  const p_city = (profile?.city ?? "").toString();
  const p_province = (profile?.province ?? "").toString();
  const p_cp = (profile?.postal_code ?? "").toString();

  const firstName = p_first || firstNameFromMeta || user.email?.split("@")[0] || "Usuario";

  const missingLabels: string[] = [];
  const notEmpty = (s: string) => (s ?? "").toString().trim().length > 0;
  if (!notEmpty(p_first)) missingLabels.push("Nombre");
  if (!notEmpty(p_last)) missingLabels.push("Apellido");
  if (!notEmpty(p_email)) missingLabels.push("Email");
  if (!notEmpty(p_dni_cuit)) missingLabels.push("DNI o CUIT");
  if (!notEmpty(p_address)) missingLabels.push("Dirección");
  if (!notEmpty(p_city)) missingLabels.push("Localidad");
  if (!notEmpty(p_province)) missingLabels.push("Provincia");
  if (!notEmpty(p_cp)) missingLabels.push("Código Postal");

  // Datos adicionales para tarjetas de métricas
  const planCode = (profile?.plan_code || metaPlan || "").toString();
  const { count: productsCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: plan } = planCode
    ? await supabase
        .from("plans")
        .select("code, name, max_products, credits_monthly")
        .eq("code", planCode)
        .single()
    : ({ data: null } as const);

  // Mostrar preferentemente el nombre dinámico del plan desde la tabla `plans`
  if (plan?.name) {
    planLabel = plan.name;
  }

  const planCodeLower = (planCode || "").toLowerCase();
  const labelLower = (planLabel || "").toLowerCase();
  const isBasicPlan = /b[áa]sico/.test(labelLower) || ["free", "basic"].includes(planCodeLower);

  const now = new Date();
  const periodYM = now.getFullYear() * 100 + (now.getMonth() + 1); // YYYYMM
  const { data: usage } = await supabase
    .from("usage_counters")
    .select("credits_used")
    .eq("user_id", user.id)
    .eq("period_ym", periodYM)
    .maybeSingle();

  const creditsUsed = usage?.credits_used ?? 0;
  const creditsMonthly = plan?.credits_monthly ?? 0;
  const maxProducts = plan?.max_products ?? null;

  // Límite de visibilidad pública por plan (enforcement del endpoint público)
  // Considera también el fallback por etiqueta cuando no hay plan_code pero el label muestra "Básico".
  const freeCodes = new Set(["gratis", "free", "basic"]);
  const plusCodes = new Set(["plus", "enterprise", "premium", "pro"]);
  const deluxeCodes = new Set(["deluxe", "diamond"]);
  const planVisibleLimit = (isBasicPlan || freeCodes.has(planCodeLower))
    ? 1
    : (plusCodes.has(planCodeLower) || /plus|enterprise|premium|pro/.test(labelLower))
    ? 15
    : (deluxeCodes.has(planCodeLower) || /deluxe|diamond/.test(labelLower))
    ? 30
    : (maxProducts ?? null);
  const exceedsVisible = typeof productsCount === "number" && planVisibleLimit != null && productsCount > planVisibleLimit;

  // (Gráfico de actividad removido)

  // Expiración estimada: 1 mes desde activación; fallback a updated_at cuando haya plan
  const activatedAt = planCode ? (profile as any)?.updated_at ?? null : null;
  let expiresAt: string | null = null;
  if (activatedAt) {
    const d = new Date(activatedAt);
    d.setMonth(d.getMonth() + 1);
    expiresAt = d.toISOString();
  }

  const fmt = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("es-AR", { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-4 sm:p-6 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Panel de control</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Bienvenido, {firstName}.</p>
        </div>
      </div>

      <section className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resumen</CardTitle>
            <CardDescription>Estado de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium"><PlanBadge planLabel={planLabel} planCode={planCode} /></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verificación</span>
              <Badge variant={emailVerified ? "default" : "secondary"}>
                {emailVerified ? "Verificado" : "No verificado"}
              </Badge>
            </div>
            {/* Enlace a detalles del plan removido */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Métricas de uso</CardTitle>
            <CardDescription>Resumen del mes actual</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              <div className="rounded-md border p-4">
                <UsageRadial
                  label="Productos"
                  value={productsCount ?? 0}
                  max={planVisibleLimit}
                  color="#8b5cf6"
                  layout="stacked"
                  size={148}
                  barSize={14}
                  showCenter={false}
                />
              </div>
              <div className="rounded-md border p-4">
                {isBasicPlan || !creditsMonthly ? (
                  <div className="h-[148px] flex items-center justify-center text-muted-foreground text-center">
                    Créditos no disponibles en Plan Básico
                  </div>
                ) : (
                  <UsageRadial
                    label="Créditos (mes)"
                    value={creditsUsed}
                    max={creditsMonthly || null}
                    color="#f06d04"
                    layout="stacked"
                    size={148}
                    barSize={14}
                    showCenter={false}
                  />
                )}
              </div>
              {!isBasicPlan && activatedAt && expiresAt && (
                <div className="rounded-md border p-4">
                  <CountdownUntil
                    label="Expira en"
                    startISO={activatedAt as any}
                    targetISO={expiresAt}
                    color="#10b981"
                    layout="stacked"
                    size={148}
                    barSize={14}
                    showCenter={false}
                  />
                </div>
              )}
            </div>
            {exceedsVisible && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Alerta: visibilidad limitada por tu plan</AlertTitle>
                <AlertDescription>
                  Actualmente tienes {productsCount} producto(s), pero tu plan permite mostrar hasta {planVisibleLimit} en listados públicos.
                  Para aumentar tu visibilidad, considera actualizar tu plan.
                  <div className="mt-2">
                    <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100">
                      <Link href="/planes">Ver planes</Link>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {/* Gráfico de líneas removido */}
          </CardContent>
        </Card>

        

        {/* Tarjeta de "Información requerida para publicar" eliminada: ahora se maneja con modal y redirección a /dashboard/profile */}

        {/* El formulario de perfil se movió a /dashboard/profile para mantener el dashboard limpio */}
      </section>
    </div>
  );
}
