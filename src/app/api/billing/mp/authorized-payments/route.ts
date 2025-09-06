import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(t));
}

export async function GET(req: Request) {
  const supabase = createRouteClient();

  // 1) Usuario actual
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  // 2) Traer mp_preapproval_id del perfil
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, mp_preapproval_id, plan_code, plan_renews_at, mp_subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr)
    return NextResponse.json({ ok: false, error: "profile_fetch_failed", details: profileErr.message }, { status: 500 });

  const preapprovalId = (profile as any)?.mp_preapproval_id as string | null;
  if (!preapprovalId) {
    return NextResponse.json({
      ok: true,
      profile,
      preapproval_id: null,
      authorized_payment: null,
      note: "No hay mp_preapproval_id asociado al perfil",
    });
  }

  // 3) Preparar MP
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) {
    return NextResponse.json({
      ok: true,
      profile,
      preapproval_id: preapprovalId,
      authorized_payment: null,
      note: "Falta MP_ACCESS_TOKEN en el entorno",
    });
  }

  // Parámetros de consulta
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("payment_id") || searchParams.get("id");

  // 4) Si se provee payment_id, obtener ese authorized_payment
  if (paymentId) {
    const payRes = await fetchWithTimeout(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      cache: "no-store",
    }, 10000);
    if (!payRes.ok) {
      const text = await payRes.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        profile,
        preapproval_id: preapprovalId,
        error: "authorized_payment_fetch_failed",
        details: text || null,
      }, { status: 502 });
    }
    const authorizedPayment = await payRes.json().catch(() => null);
    return NextResponse.json({
      ok: true,
      profile,
      preapproval_id: preapprovalId,
      authorized_payment: authorizedPayment,
      note: "Mostrando un authorized_payment por ID. No existe endpoint público para listar por preapproval_id.",
    });
  }

  // 5) Sin payment_id, devolver detalles del preapproval para diagnóstico
  const preUrl = `https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`;
  const preRes = await fetchWithTimeout(preUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    cache: "no-store",
  }, 10000);
  const pre = preRes.ok ? await preRes.json().catch(() => null) : null;

  return NextResponse.json({
    ok: true,
    profile,
    preapproval_id: preapprovalId,
    authorized_payment: null,
    preapproval: pre,
    note: "Listado de authorized_payments por preapproval_id no disponible en la API pública. Usa payment_id o valida vía webhooks.",
  });
}
