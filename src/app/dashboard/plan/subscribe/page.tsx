import { createClient } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

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

type Props = { searchParams?: Record<string, string | string[] | undefined> };

export default async function SubscribePage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const raw = searchParams?.code;
  const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!code) redirect("/dashboard/plan/failure?error=MISSING_CODE");

  const baseUrl = getBaseUrl();
  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  const successUrl = `${baseUrl}/dashboard/plan/success`;
  const failureUrl = `${baseUrl}/dashboard/plan/failure`;
  try {
    const res = await fetch(`${baseUrl}/api/billing/mp/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ code, success_url: successUrl, failure_url: failureUrl }),
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
