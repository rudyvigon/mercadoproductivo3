import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

import { createRouteClient } from "@/lib/supabase/server";
import { getSenderDisplayName } from "@/lib/names";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Configuración CAPTCHA y límites
const isProd = process.env.NODE_ENV === "production";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "";
const RATE_LIMITS = {
  perSellerPerIpPerHour: 3,
  perSellerPerEmailPerHour: 3,
  perIpPerDayGlobal: 10,
} as const;

async function verifyTurnstile(token: string, remoteIp?: string | null) {
  if (!token) return false;
  if (!TURNSTILE_SECRET) {
    // En desarrollo permitimos continuar sin secreto configurado
    if (!isProd) {
      console.warn("[Turnstile] SECRET ausente. Verificación omitida en desarrollo.");
      return true;
    }
    console.error("[Turnstile] SECRET ausente en producción.");
    return false;
  }
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      // Evitar cache
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data?.success);
  } catch (e) {
    console.warn("[Turnstile] Error verificando token:", e);
    return false;
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str: string, max = 5000) {
  return String(str || "").replace(/\u0000/g, "").slice(0, max).trim();
}

function digitsOnly(str: string) {
  return String(str || "").replace(/[^\d]/g, "");
}

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic"; // free/basic/gratis
}

function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const sellerId = sanitize(body.sellerId, 64);
    const nombre = sanitize(body.nombre, 200);
    const email = sanitize(body.email, 320);
    const telefono = sanitize(body.telefono, 64);
    const asunto = sanitize(body.asunto, 200);
    const mensaje = sanitize(body.mensaje, 5000);
    const captchaToken = sanitize(body.captchaToken, 2048);

    if (!sellerId) return NextResponse.json({ error: "MISSING_SELLER_ID" }, { status: 400 });
    if (!nombre || nombre.length < 2) return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    if (!email || !isValidEmail(email)) return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    const phoneDigits = digitsOnly(telefono);
    if (phoneDigits.length < 8 || phoneDigits.length > 15) return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    if (!asunto || asunto.length < 3) return NextResponse.json({ error: "INVALID_SUBJECT" }, { status: 400 });
    if (!mensaje || mensaje.length < 1) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });

    // Si hay usuario autenticado y coincide con sellerId, bloquear auto-mensaje
    const routeClient = createRouteClient();
    const {
      data: { user },
    } = await routeClient.auth.getUser();
    if (user && sellerId === user.id) {
      return NextResponse.json(
        { error: "CANNOT_MESSAGE_SELF", message: "No puedes enviarte mensajes a ti mismo." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validar plan del vendedor
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, plan_code")
      .eq("id", sellerId)
      .single();

    if (profErr || !prof) {
      return NextResponse.json({ error: "SELLER_NOT_FOUND" }, { status: 404 });
    }

    if (!isAllowedPlan((prof as any).plan_code)) {
      return NextResponse.json({ error: "PLAN_NOT_ALLOWED" }, { status: 403 });
    }

    // Capturar IP del cliente (primer IP en x-forwarded-for)
    const senderIpHeader = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const senderIp = senderIpHeader.split(",")[0]?.trim() || "";

    // Verificar CAPTCHA (Turnstile)
    const captchaOk = await verifyTurnstile(captchaToken, senderIp || undefined);
    if (!captchaOk) {
      return NextResponse.json({ error: "INVALID_CAPTCHA" }, { status: 400 });
    }

    // Rate limiting por IP/Email
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [ipPerSeller, emailPerSeller, ipGlobal] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", sellerId)
          .eq("sender_ip", senderIp)
          .gte("created_at", oneHourAgo),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", sellerId)
          .eq("sender_email", email)
          .gte("created_at", oneHourAgo),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_ip", senderIp)
          .gte("created_at", oneDayAgo),
      ]);

      const ipPerSellerCount = ipPerSeller.count ?? 0;
      const emailPerSellerCount = emailPerSeller.count ?? 0;
      const ipGlobalCount = ipGlobal.count ?? 0;

      if (ipPerSellerCount >= RATE_LIMITS.perSellerPerIpPerHour ||
          emailPerSellerCount >= RATE_LIMITS.perSellerPerEmailPerHour ||
          ipGlobalCount >= RATE_LIMITS.perIpPerDayGlobal) {
        return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
      }
    } catch (rlErr) {
      console.warn("[messages/contact-seller] rate-limit check failed", rlErr);
      // No bloquear si el chequeo falló, pero registrar
    }

    // Resolver nombre del remitente: si hay usuario autenticado, priorizar su perfil; si no, usar el nombre provisto
    let resolvedName = nombre;
    if (user?.id) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("company, full_name, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();
      resolvedName = getSenderDisplayName(senderProfile as any, nombre);
    }

    const { data: ins, error: insErr } = await supabase
      .from("messages")
      .insert({
        seller_id: sellerId,
        sender_name: resolvedName,
        sender_email: email,
        sender_phone: phoneDigits,
        subject: asunto,
        body: mensaje,
        sender_ip: senderIp?.slice(0, 128) || null,
        status: "new",
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[messages/contact-seller] insert error", insErr);
      return NextResponse.json({ error: "DB_INSERT_ERROR" }, { status: 500 });
    }
    // Cargar payload completo para el evento
    const { data: row, error: selErr } = await supabase
      .from("messages")
      .select("id, created_at, updated_at, seller_id, sender_name, sender_email, sender_phone, subject, body, status")
      .eq("id", ins?.id)
      .single();

    if (selErr || !row) {
      console.warn("[messages/contact-seller] select after insert warn", selErr?.message);
    } else {
      try {
        const pusher = getPusher();
        await pusher.trigger(`private-seller-${sellerId}` as string, "message:new", row);
        // Emitir también al canal del comprador para reflejar en tiempo real su propio envío
        await pusher.trigger(
          `private-thread-${sellerId}-${emailSlug((row as any).sender_email as string)}` as string,
          "message:new",
          row
        );
      } catch (ev) {
        console.warn("[messages/contact-seller] pusher trigger failed", ev);
      }
    }

    return NextResponse.json({ ok: true, id: ins?.id });
  } catch (e: any) {
    console.error("[messages/contact-seller] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
