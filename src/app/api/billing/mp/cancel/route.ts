import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(t));
}

/**
 * Cancela la suscripción en Mercado Pago y programa/ejecuta el cambio a plan gratis.
 * POST /api/billing/mp/cancel
 * Body opcional: { mode?: "at_period_end" | "immediate", reason?: string }
 * - mode: por defecto "at_period_end" (fin de ciclo). "immediate" aplica gratis ahora.
 */
export async function POST(req: Request) {
  try {
    const supabase = createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();
    const body = await req.json().catch(() => ({}) as any);
    const modeRaw = (body?.mode || body?.when || "at_period_end") as string;
    const mode: "at_period_end" | "immediate" = modeRaw === "immediate" ? "immediate" : "at_period_end";
    const reason = (body?.reason as string | undefined) || "user_requested";

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

    // Perfil actual
    const { data: profile } = await admin
      .from("profiles")
      .select("id, plan_code, plan_activated_at, plan_renews_at, plan_pending_code, plan_pending_effective_at, mp_preapproval_id, mp_subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    const now = new Date();

    // Determinar fecha efectiva
    let effectiveAt = new Date(now);
    if (mode === "at_period_end") {
      if ((profile as any)?.plan_renews_at) {
        const r = new Date((profile as any).plan_renews_at);
        if (!Number.isNaN(r.getTime()) && r > now) effectiveAt = r;
      } else if ((profile as any)?.plan_activated_at) {
        const a = new Date((profile as any).plan_activated_at);
        if (!Number.isNaN(a.getTime())) {
          const d = new Date(a);
          d.setMonth(d.getMonth() + 1);
          if (d > now) effectiveAt = d; else effectiveAt = now;
        }
      }
    }

    // Cancelar preapproval vigente (si existe)
    const oldPreId = (profile as any)?.mp_preapproval_id || null;
    let cancelledOld = false;
    if (oldPreId && MP_ACCESS_TOKEN) {
      try {
        const cancelRes = await fetchWithTimeout(`https://api.mercadopago.com/preapproval/${oldPreId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
          body: JSON.stringify({ status: "cancelled" }),
        }, 10000);
        cancelledOld = cancelRes.ok;
        if (cancelRes.ok) {
          await admin
            .from("profiles")
            .update({ mp_subscription_status: "cancelled" })
            .eq("id", user.id);
          try {
            await admin.from("billing_events").insert({
              user_id: user.id,
              kind: "subscription_cancelled_by_user",
              payload: { preapproval_id: oldPreId, mode, reason },
            } as any);
          } catch {}
        }
      } catch {}
    }

    // También cancelar un preapproval "nuevo" pausado por downgrade (si existiera)
    if (MP_ACCESS_TOKEN) {
      try {
        const { data: events } = await admin
          .from("billing_events")
          .select("id, kind, payload, created_at")
          .eq("user_id", user.id)
          .eq("kind", "preapproval_paused_on_downgrade")
          .order("created_at", { ascending: false })
          .limit(1);
        const pausedEvt = Array.isArray(events) && events.length > 0 ? (events[0] as any) : null;
        const newPreId = pausedEvt?.payload?.preapproval_id || null;
        if (newPreId) {
          await fetchWithTimeout(`https://api.mercadopago.com/preapproval/${newPreId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
            body: JSON.stringify({ status: "cancelled" }),
          }, 10000).catch(() => {});
          try {
            await admin.from("billing_events").insert({
              user_id: user.id,
              kind: "preapproval_cancelled_on_user_cancel",
              payload: { preapproval_id: newPreId, reason: "user_cancelled" },
            } as any);
          } catch {}
        }
      } catch {}
    }

    // Resolver código de plan gratis
    const { data: freePlan } = await admin
      .from("plans")
      .select("code, price_monthly, price_monthly_cents")
      .or("code.eq.free,code.eq.gratis,price_monthly.eq.0,price_monthly_cents.eq.0")
      .limit(1)
      .maybeSingle();
    const freeCode = (freePlan as any)?.code || "free";

    if (mode === "immediate") {
      // Aplicar gratis ahora
      const activatedAt = now.toISOString();
      const renews = new Date(now);
      renews.setMonth(renews.getMonth() + 1);
      const renewsAt = renews.toISOString();
      await admin
        .from("profiles")
        .update({
          plan_code: freeCode,
          plan_pending_code: null,
          plan_pending_effective_at: null,
          plan_activated_at: activatedAt,
          plan_renews_at: renewsAt,
        })
        .eq("id", user.id);
      try {
        await admin.from("billing_events").insert({
          user_id: user.id,
          kind: "plan_changed_to_free_immediate_by_user",
          payload: { effective_at: activatedAt, cancelled_preapproval: oldPreId || null },
        } as any);
      } catch {}
      return NextResponse.json({ ok: true, effective_at: activatedAt, immediate: true, cancelled: cancelledOld });
    } else {
      // Programar gratis al fin de ciclo
      await admin
        .from("profiles")
        .update({
          plan_pending_code: freeCode,
          plan_pending_effective_at: effectiveAt.toISOString(),
        })
        .eq("id", user.id);
      try {
        await admin.from("billing_events").insert({
          user_id: user.id,
          kind: "plan_change_to_free_scheduled_by_user",
          payload: { effective_at: effectiveAt.toISOString(), cancelled_preapproval: oldPreId || null },
        } as any);
      } catch {}
      return NextResponse.json({ ok: true, effective_at: effectiveAt.toISOString(), immediate: false, cancelled: cancelledOld });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected Error" }, { status: 500 });
  }
}
