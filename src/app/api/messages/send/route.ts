import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";
import { getSenderDisplayName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function sanitize(str: unknown, max = 10000) {
  return String(str ?? "").replace(/\u0000/g, "").slice(0, max).trim();
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
    const body = await req.json().catch(() => ({}));
    const sellerId = sanitize(body.sellerId, 64);
    const messageBody = sanitize(body.body, 10000);

    if (!sellerId) return NextResponse.json({ error: "MISSING_SELLER_ID" }, { status: 400 });
    if (!messageBody || messageBody.length < 1) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

    const supaRoute = createRouteClient();
    const {
      data: { user },
    } = await supaRoute.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    // Evitar que un usuario se envíe mensajes a sí mismo
    if (sellerId === user.id) {
      return NextResponse.json(
        { error: "CANNOT_MESSAGE_SELF", message: "No puedes enviarte mensajes a ti mismo." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Validar plan del vendedor
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("id, plan_code")
      .eq("id", sellerId)
      .single();

    if (profErr || !prof) return NextResponse.json({ error: "SELLER_NOT_FOUND" }, { status: 404 });
    if (!isAllowedPlan((prof as any).plan_code)) return NextResponse.json({ error: "PLAN_NOT_ALLOWED" }, { status: 403 });

    const senderEmail = user.email || "";
    // Calcular nombre de remitente preferido desde el perfil del usuario
    const { data: senderProfile } = await admin
      .from("profiles")
      .select("company, full_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const senderName = getSenderDisplayName(senderProfile as any, user.user_metadata?.name || senderEmail);
    const subjectFirstLine = (messageBody.split("\n")[0] || "").slice(0, 200).trim();
    const subject = subjectFirstLine && subjectFirstLine.length >= 3 ? subjectFirstLine : "Consulta";

    // Insertar mensaje inicial del comprador
    const { data: ins, error: insErr } = await admin
      .from("messages")
      .insert({
        seller_id: sellerId,
        sender_name: senderName,
        sender_email: senderEmail,
        subject: subject,
        body: messageBody,
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (insErr) return NextResponse.json({ error: "DB_INSERT_ERROR", details: insErr.message }, { status: 500 });

    // Cargar fila completa para evento
    const { data: row } = await admin
      .from("messages")
      .select("id, created_at, seller_id, sender_name, sender_email, subject, body, status")
      .eq("id", ins?.id)
      .single();

    // Emitir a vendedor y comprador
    try {
      const p = getPusher();
      if (row) {
        await p.trigger(`private-seller-${sellerId}` as string, "message:new", row);
        await p.trigger(
          `private-thread-${sellerId}-${emailSlug(senderEmail)}` as string,
          "message:new",
          row
        );
      }
    } catch (ev) {
      console.warn("[/api/messages/send] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, id: ins?.id, created_at: ins?.created_at });
  } catch (e: any) {
    console.error("[/api/messages/send] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
