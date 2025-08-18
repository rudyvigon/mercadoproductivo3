import { createClient } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  // En Vercel, VERCEL_URL viene sin protocolo. Construimos https://<dominio>
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

type Props = { searchParams?: Record<string, string | string[] | undefined> };

export default async function SubscribePage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const raw = searchParams?.code;
  const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!code) redirect("/dashboard/plan/failure?error=MISSING_CODE");

  // Permitir pasar el email del pagador por querystring para sandbox: ?payer_email=...
  const payerRaw = searchParams?.payer_email ?? searchParams?.payerEmail ?? searchParams?.email;
  const payer_email = typeof payerRaw === "string" ? payerRaw : Array.isArray(payerRaw) ? payerRaw[0] : undefined;

  // Alternativamente permitir pasar el ID del pagador: ?payer_id=123456789 (usuario comprador de prueba de MP)
  const payerIdRaw = searchParams?.payer_id ?? searchParams?.payerId ?? searchParams?.user_id ?? searchParams?.userId;
  const payer_id =
    typeof payerIdRaw === "string" || typeof payerIdRaw === "number"
      ? String(Array.isArray(payerIdRaw) ? payerIdRaw[0] : payerIdRaw)
      : undefined;

  const baseUrl = getBaseUrl();
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  try {
    const res = await fetch(`${baseUrl}/api/billing/mp/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ code, ...(payer_email ? { payer_email } : {}), ...(payer_id ? { payer_id } : {}) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = json?.error || "SUBSCRIBE_FAILED";
      const eff = json?.details?.plan_pending_effective_at as string | undefined;
      const pend = json?.details?.plan_pending_code as string | undefined;
      let dest = `/dashboard/plan/failure?error=${encodeURIComponent(err)}`;
      if (eff) dest += `&effective_at=${encodeURIComponent(eff)}`;
      if (pend) dest += `&pending=${encodeURIComponent(pend)}`;
      // Propagar detalle del error (texto o JSON serializado) para facilitar el diagnóstico
      const detailRaw = json?.details;
      let detail: string | undefined;
      if (typeof detailRaw === "string") detail = detailRaw;
      else if (detailRaw && typeof detailRaw === "object") detail = JSON.stringify(detailRaw);
      if (detail && detail.length > 0) dest += `&detail=${encodeURIComponent(detail)}`;
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

