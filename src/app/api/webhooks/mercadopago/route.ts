import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchPreapproval(preapprovalId: string) {
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) return null;
  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

function extractPreapprovalIdAndEvent(body: any, url: string) {
  const u = new URL(url);
  const qpId = u.searchParams.get("id");
  const preapprovalId = body?.data?.id || body?.resource?.id || body?.id || body?.preapproval_id || qpId || null;
  const action = body?.action || body?.type || body?.event || null;
  return { preapprovalId, action };
}

export async function POST(req: Request) {
  try {
    const admin = createAdminClient();

    const txt = await req.text();
    let body: any = {};
    try { body = txt ? JSON.parse(txt) : {}; } catch { body = {}; }

    const { preapprovalId, action } = extractPreapprovalIdAndEvent(body, req.url);
    if (!preapprovalId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "NO_PREAPPROVAL_ID" });
    }

    const pre = await fetchPreapproval(preapprovalId);
    const status: string | null = pre?.status || body?.status || null;
    const external: string | null = pre?.external_reference || body?.external_reference || null;

    let userId: string | null = null;
    let planCode: string | null = null;
    if (external && typeof external === "string" && external.includes(":")) {
      const [u, p] = external.split(":");
      userId = u || null;
      planCode = p || null;
    }

    // Fallback: si no viene external_reference, buscar por mp_preapproval_id
    if (!userId) {
      const { data: profByPre } = await admin
        .from("profiles")
        .select("id")
        .eq("mp_preapproval_id", preapprovalId)
        .maybeSingle();
      if (profByPre?.id) userId = profByPre.id;
    }

    if (!userId) {
      // No podemos asociar, pero registramos evento
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          type: "mp_webhook_unmatched",
          metadata: { preapproval_id: preapprovalId, status, action, body },
        } as any);
      } catch {}
      return NextResponse.json({ ok: true, unmatched: true });
    }

    // Actualizar estado de MP en perfil
    await admin
      .from("profiles")
      .update({
        mp_preapproval_id: preapprovalId,
        mp_subscription_status: status || action || null,
      })
      .eq("id", userId);

    try {
      await admin.from("billing_events").insert({
        user_id: userId,
        type: "mp_webhook",
        metadata: {
          preapproval_id: preapprovalId,
          status,
          action,
          external_reference: external,
          plan_code: planCode,
        },
      } as any);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected" }, { status: 500 });
  }
}

// Algunas integraciones de MP pueden invocar GET con query `id`
export async function GET(req: Request) {
  return POST(req);
}
