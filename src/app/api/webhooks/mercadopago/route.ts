import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function processPreapproval(preapprovalId: string) {
  const admin = createAdminClient();
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) {
    // No podemos consultar a MP, pero aceptamos el webhook para no reintentar infinito
    try {
      await admin.from("billing_events").insert({
        user_id: null,
        type: "preapproval_webhook_missing_token",
        metadata: { preapproval_id: preapprovalId },
      } as any);
    } catch {}
    return;
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          type: "preapproval_webhook_fetch_failed",
          metadata: { preapproval_id: preapprovalId, details: text || null },
        } as any);
      } catch {}
      return;
    }

    const pre = await res.json();
    const status = (pre?.status as string | undefined) || null;
    const externalRef = (pre?.external_reference as string | undefined) || null;
    const id = (pre?.id as string | undefined) || preapprovalId;

    let userId: string | null = null;
    let planCode: string | null = null;
    if (typeof externalRef === "string" && externalRef.includes(":")) {
      const [uid, code] = externalRef.split(":");
      userId = uid || null;
      planCode = code || null;
    }

    if (userId) {
      await admin
        .from("profiles")
        .update({ mp_preapproval_id: id, mp_subscription_status: status })
        .eq("id", userId);
    } else {
      // Fallback: actualizar por preapproval id para no perder estado
      await admin
        .from("profiles")
        .update({ mp_subscription_status: status })
        .eq("mp_preapproval_id", id);
    }

    try {
      await admin.from("billing_events").insert({
        user_id: userId,
        type: "preapproval_webhook",
        metadata: { preapproval_id: id, status, external_reference: externalRef, plan_code: planCode },
      } as any);
    } catch {}
  } catch (e: any) {
    try {
      await createAdminClient().from("billing_events").insert({
        user_id: null,
        type: "preapproval_webhook_exception",
        metadata: { preapproval_id: preapprovalId, error: e?.message || String(e) },
      } as any);
    } catch {}
  }
}

function getIdFromUrl(url: string) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("id") || u.searchParams.get("preapproval_id");
    return id || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  let id: string | undefined;
  try {
    const body = await req.json().catch(() => undefined);
    id = (body?.data?.id as string | undefined) || (body?.id as string | undefined) || getIdFromUrl(req.url);
    const type = (body?.type as string | undefined) || (body?.topic as string | undefined) || "";
    if ((type && type.toLowerCase().includes("preapproval")) || id) {
      if (id) await processPreapproval(id);
    }
  } catch {}
  return NextResponse.json({ ok: true, id: id || null });
}

export async function GET(req: Request) {
  const id = getIdFromUrl(req.url);
  if (id) await processPreapproval(id);
  // MP espera 200 para no reintentar
  return NextResponse.json({ ok: true, id: id || null });
}
