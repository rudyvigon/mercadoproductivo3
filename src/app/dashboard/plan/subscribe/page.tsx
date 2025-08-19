import { createClient } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

type Props = { searchParams?: Record<string, string | string[] | undefined> };

export default async function SubscribePage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const raw = searchParams?.code;
  const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!code) redirect("/dashboard/plan/failure?error=MISSING_CODE");

  const intervalRaw = searchParams?.interval;
  const intervalParam = typeof intervalRaw === "string" ? intervalRaw : Array.isArray(intervalRaw) ? intervalRaw[0] : undefined;
  const isValidInterval = intervalParam === "monthly" || intervalParam === "yearly";

  const baseUrl = getBaseUrl();
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const successUrl = `${baseUrl}/dashboard/plan/success`;
  const failureUrl = `${baseUrl}/dashboard/plan/failure`;

  // Si no se especificó intervalo, mostrar selección mensual/anual
  if (!isValidInterval) {
    // Cargar plan para mostrar precios y ahorro
    const { data: plan } = await supabase
      .from("plans")
      .select("code, name, currency, price_monthly, price_monthly_cents, price_yearly, price_yearly_cents")
      .eq("code", code)
      .maybeSingle();

    if (!plan) {
      return (
        <div className="mx-auto max-w-md p-6">
          <Card>
            <CardHeader>
              <CardTitle>Elegí tu facturación</CardTitle>
              <CardDescription>Seleccioná cómo querés que se te cobre el plan.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 justify-end">
              <Button asChild variant="outline">
                <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(code)}&interval=monthly`}>Mensual</Link>
              </Button>
              <Button asChild>
                <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(code)}&interval=yearly`}>Anual</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    const toNum = (v: any): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim().length > 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    const pm = toNum((plan as any)?.price_monthly);
    const pmc = toNum((plan as any)?.price_monthly_cents);
    const py = toNum((plan as any)?.price_yearly);
    const pyc = toNum((plan as any)?.price_yearly_cents);
    const currency = (((plan as any)?.currency as string) || "ARS").toUpperCase();
    const priceMonthly = pm != null ? pm : (pmc != null ? pmc / 100 : 0);
    const priceYearly = py != null ? py : (pyc != null ? pyc / 100 : null);
    const yearlyEffective = priceMonthly > 0 && (priceYearly == null || priceYearly <= priceMonthly + 0.01)
      ? priceMonthly * 12
      : (priceYearly ?? 0);
    const yearlySavings = priceMonthly > 0 ? (priceMonthly * 12 - yearlyEffective) : 0;
    const monthlyEquivalent = yearlyEffective > 0 ? yearlyEffective / 12 : 0;

    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>Elegí tu facturación</CardTitle>
            <CardDescription>
              Seleccioná cómo querés que se te cobre el plan{plan?.name ? ` "${plan.name}"` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="border rounded-md p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Mensual</span>
                  <span className="text-lg font-semibold">
                    {priceMonthly > 0 ? formatCurrency(priceMonthly, currency) : "Gratis"}
                  </span>
                </div>
                {priceMonthly > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Se renueva cada mes</p>
                )}
                <div className="mt-2 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(code)}&interval=monthly`}>
                      Elegir mensual
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="border rounded-md p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Anual</span>
                  <span className="text-lg font-semibold">
                    {yearlyEffective > 0 ? formatCurrency(yearlyEffective, currency) : "Gratis"}
                  </span>
                </div>
                {yearlyEffective > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>Equivale a {formatCurrency(monthlyEquivalent, currency)} / mes</p>
                    {yearlySavings > 0 && (
                      <p>Ahorro de {formatCurrency(yearlySavings, currency)} vs 12 meses</p>
                    )}
                  </div>
                )}
                <div className="mt-2 text-right">
                  <Button asChild size="sm">
                    <Link href={`/dashboard/plan/subscribe?code=${encodeURIComponent(code)}&interval=yearly`}>
                      Elegir anual
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  try {
    const res = await fetch(`${baseUrl}/api/billing/mp/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ code, interval: intervalParam, success_url: successUrl, failure_url: failureUrl }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = json?.error || "SUBSCRIBE_FAILED";
      const eff = json?.details?.plan_pending_effective_at as string | undefined;
      const pend = json?.details?.plan_pending_code as string | undefined;
      const det = typeof json?.details === "string" ? json.details : json?.details ? JSON.stringify(json.details) : undefined;
      let dest = `/dashboard/plan/failure?error=${encodeURIComponent(err)}`;
      if (eff) dest += `&effective_at=${encodeURIComponent(eff)}`;
      if (pend) dest += `&pending=${encodeURIComponent(pend)}`;
      if (det) dest += `&detail=${encodeURIComponent(det)}`;
      redirect(dest);
    }
    const redirectUrl = json?.redirect_url as string | undefined;
    if (redirectUrl && redirectUrl.length > 0) {
      redirect(redirectUrl);
    }
    redirect("/dashboard/plan/success");
  } catch (e: any) {
    // No capturar los redirects internos de Next.js
    if (isRedirectError(e)) throw e;
    const msg = typeof e?.message === "string" ? e.message : "NETWORK_ERROR";
    redirect(`/dashboard/plan/failure?error=${encodeURIComponent(msg)}`);
  }
}

