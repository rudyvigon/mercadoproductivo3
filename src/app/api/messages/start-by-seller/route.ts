import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function sanitize(str: unknown, max = 10000) {
  return String(str ?? "").replace(/\u0000/g, "").slice(0, max).trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic";
}
function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

export async function POST(req: Request) {
  try {
    const bodyJson = await req.json().catch(() => ({}));
    const contactEmail = sanitize(bodyJson?.contactEmail, 320);
    const messageBody = sanitize(bodyJson?.body, 10000);

    if (!contactEmail || !isValidEmail(contactEmail)) {
      return NextResponse.json({ error: "INVALID_CONTACT_EMAIL" }, { status: 400 });
    }
    if (!messageBody || messageBody.length < 1) {
      return NextResponse.json({ error: "INVALID_BODY", message: "El mensaje debe tener al menos 1 carácter." }, { status: 400 });
    }

    const supa = createRouteClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();

    // Validar plan del vendedor (usuario autenticado)
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("id, plan_code")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) return NextResponse.json({ error: "SELLER_NOT_FOUND" }, { status: 404 });
    // Regla: no auto-mensaje
    if ((user.email || "").toLowerCase() === contactEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "CANNOT_MESSAGE_SELF", message: "No puedes iniciar una conversación contigo mismo." },
        { status: 400 }
      );
    }
    if (!isAllowedPlan((prof as any).plan_code)) return NextResponse.json({ error: "PLAN_NOT_ALLOWED" }, { status: 403 });

    // Derivar subject de la primera línea del body
    const subjectFirstLine = (messageBody.split("\n")[0] || "").slice(0, 200).trim();
    const subject = subjectFirstLine && subjectFirstLine.length >= 3 ? subjectFirstLine : "Contacto";

    // 1) Crear hilo (messages) como placeholder (sin body del comprador)
    const { data: insMsg, error: insMsgErr } = await admin
      .from("messages")
      .insert({
        seller_id: user.id,
        sender_name: contactEmail, // sin nombre del comprador aún
        sender_email: contactEmail,
        subject,
        body: "—", // placeholder mínimo (1 carácter) para cumplir constraint; no debe mostrarse en timeline
        status: "replied", // no debe contar como 'nuevo'
      })
      .select("id, created_at, seller_id, sender_name, sender_email, subject, body, status")
      .single();

    if (insMsgErr) return NextResponse.json({ error: "DB_INSERT_ERROR", details: insMsgErr.message }, { status: 500 });

    // 2) Insertar la primera respuesta del vendedor
    const { data: insRep, error: insRepErr } = await admin
      .from("message_replies")
      .insert({ message_id: insMsg.id, sender_id: user.id, body: messageBody })
      .select("id, created_at, message_id, body, sender_id")
      .single();

    if (insRepErr) return NextResponse.json({ error: "DB_REPLY_INSERT_ERROR", details: insRepErr.message }, { status: 500 });

    // 3) Emitir eventos Pusher
    try {
      const p = getPusher();
      // A vendedor (inbox + chat)
      await p.trigger(`private-seller-${user.id}` as string, "message:new", insMsg as any);
      await p.trigger(`private-seller-${user.id}` as string, "reply:new", insRep as any);
      // A comprador (thread del comprador)
      await p.trigger(
        `private-thread-${user.id}-${emailSlug(contactEmail)}` as string,
        "reply:new",
        insRep as any
      );
    } catch (ev) {
      console.warn("[/api/messages/start-by-seller] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, id: insMsg.id, reply_id: insRep.id });
  } catch (e: any) {
    console.error("[/api/messages/start-by-seller] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
