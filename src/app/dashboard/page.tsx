import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UsageRadial, CountdownUntil } from "@/components/dashboard/kpi-charts";


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
    premium: "Premium",
    pro: "Premium",
    plus: "Plus",
    enterprise: "Plus",
  };
  let planLabel = planRaw ? (planMap[planRaw.toLowerCase()] ?? (planRaw.charAt(0).toUpperCase() + planRaw.slice(1))) : "—";
  if (planLabel === "—" && role === "anunciante") {
    // Fallback visual: si es anunciante pero aún no tiene plan_code, mostrar Básico
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
              <span className="font-medium">{planLabel}</span>
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
          <CardContent className="text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              <div className="rounded-md border p-4">
                <UsageRadial
                  label="Productos"
                  value={productsCount ?? 0}
                  max={maxProducts}
                  color="#8b5cf6"
                  layout="stacked"
                  size={148}
                  barSize={14}
                  showCenter={false}
                />
              </div>
              <div className="rounded-md border p-4">
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
              </div>
              <div className="rounded-md border p-4">
                {/* Tarjeta de Ofertas removida */}
              </div>
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
            </div>
            {/* Gráfico de líneas removido */}
          </CardContent>
        </Card>

        

        {missingLabels.length > 0 && (
          <Card id="profile-requirements-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Información requerida para publicar</CardTitle>
              <CardDescription>Debes completar estos campos antes de publicar productos</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-4 text-xs sm:pl-5 sm:text-sm">
                <li className="flex items-center justify-between">
                  <span>Nombre</span>
                  <Badge variant={p_first.trim() ? "default" : "secondary"}>{p_first.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Apellido</span>
                  <Badge variant={p_last.trim() ? "default" : "secondary"}>{p_last.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Email</span>
                  <Badge variant={p_email.trim() ? "default" : "secondary"}>{p_email.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>DNI o CUIT</span>
                  <Badge variant={p_dni_cuit.trim() ? "default" : "secondary"}>{p_dni_cuit.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Dirección</span>
                  <Badge variant={p_address.trim() ? "default" : "secondary"}>{p_address.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Localidad</span>
                  <Badge variant={p_city.trim() ? "default" : "secondary"}>{p_city.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Provincia</span>
                  <Badge variant={p_province.trim() ? "default" : "secondary"}>{p_province.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Código Postal</span>
                  <Badge variant={p_cp.trim() ? "default" : "secondary"}>{p_cp.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <a href="/dashboard/profile#profile-form-card">Completar tu información</a>
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* El formulario de perfil se movió a /dashboard/profile para mantener el dashboard limpio */}
      </section>
    </div>
  );
}
