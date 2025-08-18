import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";
import PlanBadge from "@/components/badges/plan-badge";

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
  const maxImagesPerProduct = plan?.max_images_per_product ?? null;

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
    plus: "Plus",
    enterprise: "Plus",
    deluxe: "Deluxe",
    diamond: "Deluxe",
    premium: "Plus",
    pro: "Plus",
  };
  const planLabel = plan ? (planMap[plan.code.toLowerCase()] ?? plan.name ?? plan.code) : (planCode ? (planMap[planCode.toLowerCase()] ?? planCode) : "Sin plan");

  // Flags y estados derivados
  const lc = (planCode || plan?.code || "").toLowerCase();
  const isBasicPlan = lc === "free" || lc === "basic" || (planLabel || "").toLowerCase().includes("básico");
  const isPlusOrDeluxe = ["plus", "enterprise", "deluxe"].includes(lc) || /(plus|deluxe)/i.test(planLabel || "");
  const renewsAt = (profile as any)?.plan_renews_at ?? null;
  const mpStatus = (profile as any)?.mp_subscription_status ?? null as string | null;
  const mpStatusLabel = mpStatus
    ? ({ authorized: "Autorizada", pending: "Pendiente", paused: "Pausada", cancelled: "Cancelada" } as Record<string, string>)[mpStatus] ?? mpStatus
    : "—";
  const hasPending = Boolean(profile?.plan_pending_code);

  // Rol: normalizar a buyer/seller usando metadata con fallback a profile.role_code
  const roleMeta = (user.user_metadata?.role || (user.user_metadata as any)?.user_type || "").toString();
  const roleFromProfile = (profile?.role_code || "").toString();
  const roleRaw = roleMeta || roleFromProfile;
  const roleNormalized = roleRaw === "anunciante" ? "seller" : roleRaw;
  const isSeller = roleNormalized === "seller" || !!planCode || (productsCount ?? 0) > 0;
  const roleLabel = isSeller ? "Vendedor" : "Comprador";

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
            <PlanBadge planLabel={planLabel} planCode={planCode} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Rol</div>
              <div className="font-medium">{roleLabel}</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Productos</div>
              <div className="font-medium">
                {productsCount ?? 0}{maxProducts ? ` / ${maxProducts}` : ""}
              </div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Imágenes por producto</div>
              <div className="font-medium">{maxImagesPerProduct ?? "—"}</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-muted-foreground">Créditos usados (mes)</div>
              {isBasicPlan || !creditsMonthly ? (
                <div className="font-medium text-muted-foreground">Créditos no disponibles en Plan Básico</div>
              ) : (
                <div className="font-medium">{creditsUsed}{creditsMonthly ? ` / ${creditsMonthly}` : ""}</div>
              )}
            </div>
            {/* Tarjeta de ofertas removida */}
            {isPlusOrDeluxe && (
              <>
                <div className="rounded-md border p-4">
                  <div className="text-muted-foreground">Activación</div>
                  <div className="font-medium">{formatDate(activatedAt)}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-muted-foreground">Expira</div>
                  <div className="font-medium">{formatDate(expiresAt)}</div>
                </div>
              </>
            )}
            {isPlusOrDeluxe && (
              <>
                <div className="rounded-md border p-4">
                  <div className="text-muted-foreground">Suscripción</div>
                  <div className="font-medium">{mpStatusLabel}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-muted-foreground">Renueva</div>
                  <div className="font-medium">{mpStatus === "authorized" ? formatDate(renewsAt) : "—"}</div>
                </div>
              </>
            )}
          </div>

          {isPlusOrDeluxe && !activatedAt && (
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
              const isDisabled = Boolean(isCurrent || hasPending);
              return (
                <div key={p.code} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{code}</div>
                  </div>
                  <Button asChild size="sm" variant={isDisabled ? "secondary" : "default"} disabled={isDisabled}>
                    <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(p.code)}`} prefetch={false}>
                      {isCurrent ? "Plan actual" : hasPending ? "Cambio pendiente" : "Cambiar / Contratar"}
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

