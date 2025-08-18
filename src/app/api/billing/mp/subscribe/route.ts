import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBaseUrl() {
  const envSite = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envSite) return envSite.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return "";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();

    const body = await req.json().catch(() => ({} as any));
    const planCodeRaw = body?.code ?? body?.plan_code;
    if (!planCodeRaw || typeof planCodeRaw !== "string") {
      return NextResponse.json({ error: "MISSING_PLAN_CODE" }, { status: 400 });
    }
    const planCode = planCodeRaw.trim();

    // Cargar plan (incluye columnas opcionales de precio/moneda)
    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("code, name, currency, price_monthly, price_monthly_cents")
      .eq("code", planCode)
      .maybeSingle();
    if (planErr || !plan) {
      return NextResponse.json({ error: "PLAN_NOT_FOUND", details: planErr?.message || null }, { status: 404 });
    }

    // Cargar perfil
    const { data: profile } = await admin
      .from("profiles")
      .select("id, plan_code, plan_activated_at, plan_renews_at, plan_pending_code, plan_pending_effective_at, mp_preapproval_id, mp_subscription_status, mp_payer_email")
      .eq("id", user.id)
      .maybeSingle();

    const now = new Date();
    let effectiveAt = now;
    if (profile?.plan_code) {
      if (profile?.plan_renews_at) {
        const r = new Date(profile.plan_renews_at);
        if (!Number.isNaN(r.getTime())) effectiveAt = r;
      } else if (profile?.plan_activated_at) {
        const a = new Date(profile.plan_activated_at);
        if (!Number.isNaN(a.getTime())) {
          const d = new Date(a);
          d.setMonth(d.getMonth() + 1);
          effectiveAt = d;
        }
      }
    }

    const priceMonthly = typeof (plan as any).price_monthly === "number" ? (plan as any).price_monthly
      : typeof (plan as any).price_monthly_cents === "number" ? ((plan as any).price_monthly_cents / 100)
      : 0;
    const currency = (plan as any).currency || "ARS";

    const siteUrl = getBaseUrl();
    const successUrl = body?.success_url || (siteUrl ? `${siteUrl}/dashboard/plan/success` : "/dashboard/plan/success");
    const failureUrl = body?.failure_url || (siteUrl ? `${siteUrl}/dashboard/plan/failure` : "/dashboard/plan/failure");

    // Token de MP (si existe). Para planes pagos es requerido; para cancelar en downgrade es opcional.
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

    // Evitar reprocesar si el usuario ya tiene un cambio programado vigente (una vez por ciclo)
    if (profile?.plan_pending_code && profile?.plan_pending_effective_at) {
      const pendingEff = new Date(profile.plan_pending_effective_at);
      const nowCheck = new Date();
      if (!Number.isNaN(pendingEff.getTime()) && pendingEff > nowCheck) {
        return NextResponse.json(
          {
            error: "PLAN_CHANGE_ALREADY_SCHEDULED",
            details: { plan_pending_code: profile.plan_pending_code, plan_pending_effective_at: profile.plan_pending_effective_at },
          },
          { status: 400 },
        );
      }
    }

    // Si intenta contratar el mismo plan, no hacemos nada y confirmamos éxito
    if ((profile?.plan_code || "") === plan.code) {
      return NextResponse.json({ redirect_url: successUrl + "?already=1" });
    }

    // Si el plan es gratuito o sin precio, no crear preapproval: programar o activar directamente
    if (!priceMonthly || priceMonthly <= 0) {
      if (!profile?.plan_code) {
        // Sin plan actual: activar inmediatamente
        const activatedAt = now.toISOString();
        const renews = new Date(now);
        renews.setMonth(renews.getMonth() + 1);
        const renewsAt = renews.toISOString();
        await admin
          .from("profiles")
          .update({
            plan_code: plan.code,
            plan_pending_code: null,
            plan_pending_effective_at: null,
            plan_activated_at: activatedAt,
            plan_renews_at: renewsAt,
            mp_preapproval_id: null,
            mp_subscription_status: null,
          })
          .eq("id", user.id);
        // Intentar registrar evento (ignorar errores)
        try {
          await admin.from("billing_events").insert({
            user_id: user.id,
            type: "free_plan_activated",
            metadata: { plan_code: plan.code },
          } as any);
        } catch {}
        return NextResponse.json({ redirect_url: successUrl + "?free=1" });
      } else {
        // Con plan actual: programar cambio a fin de ciclo
        await admin
          .from("profiles")
          .update({
            plan_pending_code: plan.code,
            plan_pending_effective_at: effectiveAt.toISOString(),
          })
          .eq("id", user.id);
        // Si hay una suscripción activa en MP, intentar cancelarla para evitar débitos futuros
        if ((profile as any)?.mp_preapproval_id && MP_ACCESS_TOKEN) {
          try {
            const preId = (profile as any).mp_preapproval_id as string;
            const cancelRes = await fetch(`https://api.mercadopago.com/preapproval/${preId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({ status: "cancelled" }),
            });
            if (cancelRes.ok) {
              await admin
                .from("profiles")
                .update({ mp_subscription_status: "cancelled" })
                .eq("id", user.id);
              try {
                await admin.from("billing_events").insert({
                  user_id: user.id,
                  type: "preapproval_cancelled",
                  metadata: { preapproval_id: preId, reason: "downgrade_to_free" },
                } as any);
              } catch {}
            }
          } catch {}
        }
        try {
          await admin.from("billing_events").insert({
            user_id: user.id,
            type: "plan_change_scheduled",
            metadata: { plan_code: plan.code, effective_at: effectiveAt.toISOString() },
          } as any);
        } catch {}
        return NextResponse.json({ redirect_url: successUrl + "?scheduled=1" });
      }
    }

    // Plan pago: crear preapproval en Mercado Pago
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "MISSING_MP_ACCESS_TOKEN" }, { status: 500 });
    }

    const payerEmail = (profile?.mp_payer_email as string) || (user.email as string) || undefined;
    if (!payerEmail) {
      return NextResponse.json({ error: "MISSING_PAYER_EMAIL" }, { status: 400 });
    }

    const reason = `Suscripción ${plan.name || plan.code}`;
    const externalReference = `${user.id}:${plan.code}`;

    const preapprovalBody: Record<string, any> = {
      payer_email: payerEmail,
      back_url: successUrl,
      notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      reason,
      external_reference: externalReference,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: priceMonthly,
        currency_id: currency,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preapprovalBody),
    });

    if (!mpRes.ok) {
      const txt = await mpRes.text().catch(() => "");
      return NextResponse.json({ error: "MP_PREAPPROVAL_FAILED", details: txt || null }, { status: 502 });
    }

    const pre = await mpRes.json();
    const preapprovalId = pre?.id as string | undefined;
    const initPoint = (pre?.init_point || pre?.sandbox_init_point) as string | undefined;
    const status = (pre?.status as string | undefined) || "pending";

    // Programar cambio y guardar datos de MP
    await admin
      .from("profiles")
      .update({
        plan_pending_code: plan.code,
        plan_pending_effective_at: effectiveAt.toISOString(),
        mp_preapproval_id: preapprovalId ?? null,
        mp_subscription_status: status,
        mp_payer_email: payerEmail,
      })
      .eq("id", user.id);

    try {
      await admin.from("billing_events").insert({
        user_id: user.id,
        type: "preapproval_created",
        metadata: {
          plan_code: plan.code,
          effective_at: effectiveAt.toISOString(),
          preapproval_id: preapprovalId,
          status,
        },
      } as any);
    } catch {}

    if (!initPoint) {
      // Si no hay URL de redirección, llevar a success y que el webhook confirme
      return NextResponse.json({ redirect_url: successUrl + "?created=1" });
    }

    return NextResponse.json({ redirect_url: initPoint });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected Error" }, { status: 500 });
  }
}
