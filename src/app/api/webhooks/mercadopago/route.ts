import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(t));
}

async function processPreapproval(preapprovalId: string) {
  const admin = createAdminClient();
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) {
    // No podemos consultar a MP, pero aceptamos el webhook para no reintentar infinito
    try {
      await admin.from("billing_events").insert({
        user_id: null,
        kind: "preapproval_webhook_missing_token",
        payload: { preapproval_id: preapprovalId },
      } as any);
    } catch {}
    return;
  }

  // Helper para obtener precio del plan (scope de la función, no dentro de bloques)
  const getPlanPrice = async (code?: string | null): Promise<number> => {
    if (!code) return 0;
    const { data } = await admin
      .from("plans")
      .select("code, price_monthly, price_monthly_cents")
      .eq("code", code)
      .maybeSingle();
    const toNum = (v: any): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim().length > 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    const pm = toNum((data as any)?.price_monthly);
    const pmc = toNum((data as any)?.price_monthly_cents);
    const monthly = pm != null ? pm : (pmc != null ? pmc / 100 : null);
    return monthly != null ? monthly : 0;
  };

  try {
    const res = await fetchWithTimeout(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      cache: "no-store",
    }, 10000);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          kind: "preapproval_webhook_fetch_failed",
          payload: { preapproval_id: preapprovalId, details: text || null },
        } as any);
      } catch {}
      return;
    }

    const pre = await res.json();
    const status = (pre?.status as string | undefined) || null;
    const externalRef = (pre?.external_reference as string | undefined) || null;
    const id = (pre?.id as string | undefined) || preapprovalId;
    const reason = (pre?.reason as string | undefined) || null;
    const auto = (pre?.auto_recurring as any) || {};
    const freq = (auto?.frequency as number | undefined) ?? null;
    const ftype = (auto?.frequency_type as string | undefined) ?? null;
    const amount = (auto?.transaction_amount as number | undefined) ?? null;
    const currency_id = (auto?.currency_id as string | undefined) ?? null;

    let userId: string | null = null;
    let planCode: string | null = null;
    let refInterval: string | null = null;
    if (typeof externalRef === "string" && externalRef.includes(":")) {
      const parts = externalRef.split(":");
      const uid = parts[0];
      const code = parts[1];
      const inter = parts[2];
      userId = uid || null;
      planCode = code || null;
      refInterval = inter || null;
    }

    // Cargar perfil actual (para decidir upgrade/downgrade)
    let profile: any | null = null;
    if (userId) {
      const { data: p } = await admin
        .from("profiles")
        .select("id, plan_code, plan_activated_at, plan_renews_at, plan_pending_code, plan_pending_effective_at, mp_preapproval_id, mp_subscription_status")
        .eq("id", userId)
        .maybeSingle();
      profile = p as any;
    }

    // Sincronizar estado de suscripción cuando el preapproval coincide con el actual del perfil
    if (userId && profile?.mp_preapproval_id && profile.mp_preapproval_id === id && status) {
      try {
        await admin
          .from("profiles")
          .update({ mp_subscription_status: status })
          .eq("id", userId);
      } catch {}
    }

    // Manejar cancelación originada en MP: programar cambio a plan gratis al fin de ciclo
    if (userId && status === "cancelled") {
      try {
        // Si ya hay un cambio programado, no sobreescribir
        const alreadyPending = !!(profile?.plan_pending_code);
        if (!alreadyPending) {
          // Buscar plan gratis (price 0) o código 'free'/'gratis'
          const { data: freePlan } = await admin
            .from("plans")
            .select("code, price_monthly, price_monthly_cents")
            .or("code.eq.free,code.eq.gratis,price_monthly.eq.0,price_monthly_cents.eq.0")
            .limit(1)
            .maybeSingle();
          const freeCode = (freePlan as any)?.code || "free";

          // Calcular fecha efectiva al fin del ciclo si existe; caso contrario, inmediata
          let effectiveAt = new Date();
          if (profile?.plan_renews_at) {
            const r = new Date(profile.plan_renews_at);
            if (!Number.isNaN(r.getTime()) && r > new Date()) effectiveAt = r;
          } else if (profile?.plan_activated_at) {
            const a = new Date(profile.plan_activated_at);
            if (!Number.isNaN(a.getTime())) {
              const d = new Date(a);
              d.setMonth(d.getMonth() + 1);
              if (d > new Date()) effectiveAt = d;
            }
          }

          await admin
            .from("profiles")
            .update({ plan_pending_code: freeCode, plan_pending_effective_at: effectiveAt.toISOString(), mp_subscription_status: status })
            .eq("id", userId);

          try {
            await admin.from("billing_events").insert({
              user_id: userId,
              kind: "subscription_cancelled_by_mp",
              payload: { preapproval_id: id, plan_pending_code: freeCode, effective_at: effectiveAt.toISOString() },
            } as any);
          } catch {}
        }
      } catch {}
    }

    // Evitar sobrescribir el preapproval actual del usuario en downgrades.
    // Sólo usar fallback por preapproval_id cuando no tengamos userId.
    if (!userId) {
      await admin
        .from("profiles")
        .update({ mp_subscription_status: status })
        .eq("mp_preapproval_id", id);
    }

    // Si el preapproval está autorizado y podemos determinar plan y perfil, decidir si aplicar inmediato
    if (status === "authorized" && userId && planCode) {
      const currentPrice = await getPlanPrice(profile?.plan_code || null);
      const targetPrice = await getPlanPrice(planCode);
      const isUpgrade = targetPrice > currentPrice;

      if (isUpgrade) {
        // Aplicar cambio inmediato
        const now = new Date();
        const renews = new Date(now);
        const freq = (pre?.auto_recurring?.frequency as number | undefined) ?? 1;
        const ftype = (pre?.auto_recurring?.frequency_type as string | undefined) ?? "months";
        if (ftype === "months") {
          renews.setMonth(renews.getMonth() + (typeof freq === "number" && freq > 0 ? freq : 1));
        } else if (ftype === "days") {
          renews.setDate(renews.getDate() + (typeof freq === "number" && freq > 0 ? freq : 30));
        } else {
          renews.setMonth(renews.getMonth() + 1);
        }

        await admin
          .from("profiles")
          .update({
            plan_code: planCode,
            plan_pending_code: null,
            plan_pending_effective_at: null,
            plan_activated_at: now.toISOString(),
            plan_renews_at: renews.toISOString(),
            mp_preapproval_id: id,
            mp_subscription_status: status,
          })
          .eq("id", userId);

        // Cancelar preapproval anterior si existía y es distinto
        const oldPreId = profile?.mp_preapproval_id && profile.mp_preapproval_id !== id ? profile.mp_preapproval_id : null;
        if (oldPreId) {
          try {
            await fetchWithTimeout(`https://api.mercadopago.com/preapproval/${oldPreId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
              body: JSON.stringify({ status: "cancelled" }),
            }, 10000);
            await admin
              .from("billing_events")
              .insert({
                user_id: userId,
                kind: "preapproval_cancelled_on_upgrade",
                payload: {
                  previous_preapproval_id: oldPreId,
                  new_preapproval_id: id,
                  frequency: freq,
                  amount: amount,
                  interval: refInterval,
                  reason: reason,
                },
              } as any);
          } catch {}
        }

        try {
          await admin.from("billing_events").insert({
            user_id: userId,
            kind: "plan_upgraded_immediate",
            payload: {
              preapproval_id: id,
              plan_code: planCode,
              frequency: freq,
              amount: amount,
              interval: refInterval,
              reason: reason,
            },
          } as any);
        } catch {}
      } else {
        // Downgrade: mantener scheduling (no aplicar inmediato). Sólo registramos evento.
        // Intentar pausar el nuevo preapproval para evitar cobros en paralelo
        try {
          await fetchWithTimeout(`https://api.mercadopago.com/preapproval/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
            body: JSON.stringify({ status: "paused" }),
          }, 10000);
          await admin.from("billing_events").insert({
            user_id: userId,
            kind: "preapproval_paused_on_downgrade",
            payload: {
              preapproval_id: id,
              target_plan_code: planCode,
              frequency: freq,
              amount: amount,
              interval: refInterval,
              reason: reason,
            },
          } as any);
        } catch {}
        try {
          await admin.from("billing_events").insert({
            user_id: userId,
            kind: "plan_downgrade_scheduled_keep_current_until_renewal",
            payload: {
              preapproval_id: id,
              target_plan_code: planCode,
              frequency: freq,
              amount: amount,
              interval: refInterval,
              reason: reason,
            },
          } as any);
        } catch {}
      }
    }

    try {
      await admin.from("billing_events").insert({
        user_id: userId,
        kind: "preapproval_webhook",
        payload: { preapproval_id: id, status, external_reference: externalRef, plan_code: planCode, interval: refInterval, amount, currency_id, frequency: freq, frequency_type: ftype, reason },
      } as any);
    } catch {}
  } catch (e: any) {
    try {
      await createAdminClient().from("billing_events").insert({
        user_id: null,
        kind: "preapproval_webhook_exception",
        payload: { preapproval_id: preapprovalId, error: e?.message || String(e) },
      } as any);
    } catch {}
  }
}

// Procesa un cobro de suscripción autorizada (renovación)
async function processAuthorizedPayment(paymentId: string) {
  const admin = createAdminClient();
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) {
    try {
      await admin.from("billing_events").insert({
        user_id: null,
        kind: "authorized_payment_missing_token",
        payload: { payment_id: paymentId },
      } as any);
    } catch {}
    return;
  }

  try {
    // 1) Obtener el pago autorizado
    const payRes = await fetchWithTimeout(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      cache: "no-store",
    }, 10000);
    if (!payRes.ok) {
      const text = await payRes.text().catch(() => "");
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          kind: "authorized_payment_fetch_failed",
          payload: { payment_id: paymentId, details: text || null },
        } as any);
      } catch {}
      return;
    }

    const payment = await payRes.json();
    const status = (payment?.status as string | undefined) || null;
    const statusDetail = (payment?.status_detail as string | undefined) || null;
    const preapprovalId = (payment?.preapproval_id as string | undefined)
      || (payment?.preapproval?.id as string | undefined)
      || undefined;

    // 2) Verificar si el pago fue exitoso antes de avanzar la renovación
    const isSuccess =
      (typeof status === "string" && status.toLowerCase() === "approved") ||
      (typeof statusDetail === "string" && statusDetail.toLowerCase() === "accredited");

    if (!isSuccess) {
      // Registrar intento fallido y no mover la fecha de renovación
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          kind: "subscription_payment_failed",
          payload: {
            payment_id: paymentId,
            preapproval_id: preapprovalId || null,
            status,
            status_detail: statusDetail,
            amount: (payment?.transaction_amount ?? payment?.amount ?? null) as number | null,
            currency_id: (payment?.currency_id ?? null) as string | null,
            raw: payment || null,
          },
        } as any);
      } catch {}
      return;
    }

    // 3) Si no obtenemos preapproval, no podemos mapear a usuario de forma confiable
    if (!preapprovalId) {
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          kind: "authorized_payment_missing_preapproval",
          payload: { payment_id: paymentId, raw: payment || null },
        } as any);
      } catch {}
      return;
    }

    // 4) Obtener detalles del preapproval para extraer external_reference y frecuencia
    const preRes = await fetchWithTimeout(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      cache: "no-store",
    }, 10000);
    if (!preRes.ok) {
      const text = await preRes.text().catch(() => "");
      try {
        await admin.from("billing_events").insert({
          user_id: null,
          kind: "authorized_payment_preapproval_fetch_failed",
          payload: { payment_id: paymentId, preapproval_id: preapprovalId, details: text || null },
        } as any);
      } catch {}
      return;
    }

    const pre = await preRes.json();
    const externalRef = (pre?.external_reference as string | undefined) || null;
    const auto = (pre?.auto_recurring as any) || {};
    const freq = (auto?.frequency as number | undefined) ?? 1;
    const ftype = (auto?.frequency_type as string | undefined) ?? "months";

    // 4) Resolver userId a partir del external_reference `${userId}:${planCode}:${interval}`
    let userId: string | null = null;
    if (typeof externalRef === "string" && externalRef.includes(":")) {
      const parts = externalRef.split(":");
      userId = parts[0] || null;
    }

    // 5) Calcular la próxima fecha de renovación
    const now = new Date();
    const renews = new Date(now);
    if (ftype === "months") {
      renews.setMonth(renews.getMonth() + (typeof freq === "number" && freq > 0 ? freq : 1));
    } else if (ftype === "days") {
      renews.setDate(renews.getDate() + (typeof freq === "number" && freq > 0 ? freq : 30));
    } else {
      renews.setMonth(renews.getMonth() + 1);
    }
    const nextRenewsAt = renews.toISOString();

    // 6) Actualizar el perfil (preferimos por userId; si no, por mp_preapproval_id)
    if (userId) {
      await admin
        .from("profiles")
        .update({ plan_renews_at: nextRenewsAt, mp_subscription_status: "authorized" })
        .eq("id", userId);
    } else {
      await admin
        .from("profiles")
        .update({ plan_renews_at: nextRenewsAt, mp_subscription_status: "authorized" })
        .eq("mp_preapproval_id", preapprovalId);
    }

    // 6.1) Reacreditar créditos mensuales al renovarse la suscripción
    try {
      let targetUserId: string | null = userId;
      if (!targetUserId && preapprovalId) {
        const { data: prof } = await admin
          .from("profiles")
          .select("id")
          .eq("mp_preapproval_id", preapprovalId)
          .maybeSingle();
        targetUserId = (prof as any)?.id || null;
      }
      if (targetUserId) {
        const { data: credited, error: refillError } = await admin.rpc("refill_monthly_credits", { p_user: targetUserId });
        try {
          await admin.from("billing_events").insert({
            user_id: targetUserId,
            kind: "credits_refilled_on_renewal",
            payload: { payment_id: paymentId, preapproval_id: preapprovalId, credited: credited ?? null },
          } as any);
        } catch {}
        if (refillError) {
          try {
            await admin.from("billing_events").insert({
              user_id: targetUserId,
              kind: "credits_refill_error",
              payload: { payment_id: paymentId, preapproval_id: preapprovalId, error: (refillError as any)?.message || null },
            } as any);
          } catch {}
        }
      }
    } catch {}

    // 7) Registrar evento de renovación
    try {
      await admin.from("billing_events").insert({
        user_id: userId,
        kind: "subscription_renewed",
        payload: {
          payment_id: paymentId,
          preapproval_id: preapprovalId,
          amount: (payment?.transaction_amount ?? payment?.amount ?? null) as number | null,
          currency_id: (payment?.currency_id ?? null) as string | null,
          frequency: freq,
          frequency_type: ftype,
          status,
          status_detail: statusDetail,
        },
      } as any);
    } catch {}
  } catch (e: any) {
    try {
      await createAdminClient().from("billing_events").insert({
        user_id: null,
        kind: "authorized_payment_exception",
        payload: { payment_id: paymentId, error: e?.message || String(e) },
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
    // Leer cuerpo crudo para validar firma
    const raw = await req.text().catch(() => "");

    // Parsear body temprano para detectar modo de prueba
    const body = raw ? (JSON.parse(raw) as any) : undefined;
    const allowTests = process.env.MP_WEBHOOK_ALLOW_TESTS === "true";
    const isTest = body?.live_mode === false;

    // Validación HMAC si hay secreto configurado
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret) {
      const sigHeader =
        (req.headers.get("x-signature") ||
          req.headers.get("x-hub-signature-256") ||
          req.headers.get("x-hub-signature")) ?? "";

      let provided = sigHeader.trim();
      const m = /sha256=([a-f0-9]+)/i.exec(provided);
      if (m) provided = m[1];

      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      const ok =
        provided.length === expected.length &&
        timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

      if (!ok) {
        const admin = createAdminClient();
        // Si permitimos pruebas en QA, omitir rechazo y registrar bypass
        if (allowTests) {
          try {
            await admin.from("billing_events").insert({
              user_id: null,
              kind: "webhook_signature_bypassed_for_test",
              payload: { provided: sigHeader || null },
            } as any);
          } catch {}
        } else {
          // En producción rechazamos; en otros entornos registramos y continuamos
          try {
            await admin.from("billing_events").insert({
              user_id: null,
              kind: "webhook_signature_failed",
              payload: { provided: sigHeader || null },
            } as any);
          } catch {}
          if (process.env.NODE_ENV === "production") {
            return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
          }
        }
      }
    }
    id = (body?.data?.id as string | undefined) || (body?.id as string | undefined) || getIdFromUrl(req.url);
    const typeRaw = (body?.type as string | undefined) || (body?.topic as string | undefined) || "";
    const type = typeRaw.toLowerCase();
    const isPreapproval = /preapproval/.test(type);
    const isAuthorizedPayment = /authorized_?payment/.test(type) || /authorized_payments?/.test(type);

    if (isPreapproval && id) {
      await processPreapproval(id);
    } else if (isAuthorizedPayment && id) {
      await processAuthorizedPayment(id);
    } else if (!type && id) {
      // Fallback: si no viene type, asumimos preapproval (comportamiento previo)
      await processPreapproval(id);
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
