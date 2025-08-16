import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsageLineChart } from "@/components/dashboard/usage-charts";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}

export default async function PlanPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Perfil + plan del usuario
  let { data: profile } = await supabase
    .from("profiles")
    .select("plan_code, role_code, updated_at, plan_activated_at, plan_renews_at, plan_pending_code, plan_pending_effective_at, mp_subscription_status, mp_preapproval_id")
    .eq("id", user.id)
    .single();

  // Si hay un cambio programado vencido, aplicarlo de forma perezosa
  if (profile?.plan_pending_code && profile?.plan_pending_effective_at) {
    const now = new Date();
    const eff = new Date(profile.plan_pending_effective_at);
    if (!Number.isNaN(eff.getTime()) && now >= eff) {
      // Sólo aplicar si no hay preapproval de MP o si está autorizado
      const hasPreapproval = !!(profile as any)?.mp_preapproval_id;
      const mpStatus = (profile as any)?.mp_subscription_status || null;
      const canApply = !hasPreapproval || mpStatus === "authorized";
      if (canApply) {
        const newActivatedAt = new Date();
        const newRenewsAt = new Date(newActivatedAt);
        newRenewsAt.setMonth(newRenewsAt.getMonth() + 1);
        await supabase
          .from("profiles")
          .update({
            plan_code: profile.plan_pending_code,
            plan_pending_code: null,
            plan_pending_effective_at: null,
            plan_activated_at: newActivatedAt.toISOString(),
            plan_renews_at: newRenewsAt.toISOString(),
          })
          .eq("id", user.id);
        // refrescar perfil
        const { data: refreshed } = await supabase
          .from("profiles")
          .select("plan_code, role_code, updated_at, plan_activated_at, plan_renews_at, plan_pending_code, plan_pending_effective_at, mp_subscription_status, mp_preapproval_id")
          .eq("id", user.id)
          .single();
        (profile as any) = refreshed as any;
      }
    }
  }

  const planCode = (profile?.plan_code || "").toString();
  const roleCode = (profile?.role_code || "").toString();

  // Plan (detalles)
  const { data: plan } = planCode
    ? await supabase.from("plans").select("code, name, max_products, max_images_per_product, credits_monthly").eq("code", planCode).single()
    : { data: null } as const;

  // Conteo de productos del usuario
  const { count: productsCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Uso mensual de créditos (tabla usage_counters)
  const now = new Date();
  const periodYM = now.getFullYear() * 100 + (now.getMonth() + 1); // YYYYMM
  const { data: usage } = await supabase
    .from("usage_counters")
    .select("credits_used")
    .eq("user_id", user.id)
    .eq("period_ym", periodYM)
    .maybeSingle();

  const creditsUsed = usage?.credits_used ?? 0;

  const maxProducts = plan?.max_products ?? null;
  const creditsMonthly = plan?.credits_monthly ?? 0;

  // Activación y expiración (1 mes desde activación)
  // Fallback temporal: si no existe plan_activated_at, usamos updated_at cuando hay plan
  const activatedAt = planCode ? ((profile as any)?.plan_activated_at ?? (profile as any)?.updated_at ?? null) : null;
  let expiresAt: string | null = null;
  if (activatedAt) {
    const d = new Date(activatedAt);
    d.setMonth(d.getMonth() + 1);
    expiresAt = d.toISOString();
  }

  // Rotular plan de forma amigable
  const planMap: Record<string, string> = {
    free: "Básico",
    basic: "Básico",
    premium: "Premium",
    pro: "Premium",
    plus: "Plus",
    enterprise: "Plus",
  };
  const planLabel = plan ? (planMap[plan.code.toLowerCase()] ?? plan.name ?? plan.code) : (planCode ? (planMap[planCode.toLowerCase()] ?? planCode) : "Sin plan");

  // Cargar planes disponibles (para cambiar/contratar)
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  let plans: Array<{ code: string; name: string | null; price_monthly_cents?: number | null; price_monthly?: number | null; currency?: string | null } & Record<string, any>> = [];
  try {
    const res = await fetch(`${baseUrl}/api/public/plans`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      plans = Array.isArray(json?.plans) ? json.plans : [];
    }
  } catch {}

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4 sm:p-6 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mi Plan</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Gestiona tu suscripción y uso</p>
        </div>
        <div>
          <Link className="text-sm text-primary underline" href="/dashboard">Volver al panel</Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Plan actual</CardTitle>
              <CardDescription>Detalles y consumo</CardDescription>
            </div>
            <Badge variant="default">{planLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Rol</div>
              <div className="font-medium capitalize">{roleCode || "—"}</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Productos</div>
              <div className="font-medium">
                {productsCount ?? 0}{maxProducts ? ` / ${maxProducts}` : ""}
              </div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Créditos usados (mes)</div>
              <div className="font-medium">{creditsUsed}{creditsMonthly ? ` / ${creditsMonthly}` : ""}</div>
            </div>
            {/* Tarjeta de ofertas removida */}
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Activación</div>
              <div className="font-medium">{formatDate(activatedAt)}</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Expira</div>
              <div className="font-medium">{formatDate(expiresAt)}</div>
            </div>
          </div>

          {!activatedAt && (
            <p className="text-xs text-muted-foreground">
              Para calcular la expiración, se recomienda guardar la fecha de activación en <code>profiles.plan_activated_at</code> cuando se asigne o cambie el plan.
            </p>
          )}

          {profile?.plan_pending_code && (
            <div className="rounded-md border p-4 text-sm bg-muted/30">
              <div className="font-medium">Cambio programado</div>
              <div className="text-muted-foreground">
                Tu plan cambiará a <span className="font-medium">{profile.plan_pending_code}</span> el {formatDate(profile.plan_pending_effective_at)}.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selector de planes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Cambiar de plan</CardTitle>
          <CardDescription>El cambio se aplicará al cierre de tu ciclo actual.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p: any) => {
              const code = (p.code || "").toLowerCase();
              const label = p.name || p.code || "Plan";
              const isCurrent = planCode && planCode.toLowerCase() === code;
              return (
                <div key={p.code} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{code}</div>
                  </div>
                  <Button asChild size="sm" variant={isCurrent ? "secondary" : "default"} disabled={isCurrent}>
                    <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(p.code)}`} prefetch={false}>
                      {isCurrent ? "Plan actual" : "Cambiar / Contratar"}
                    </Link>
                  </Button>
                </div>
              );
            })}
            {plans.length === 0 && (
              <div className="text-sm text-muted-foreground">No hay planes configurados.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

