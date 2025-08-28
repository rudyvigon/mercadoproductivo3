import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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

function sanitize(str: unknown, max = 10000) {
  return String(str ?? "").replace(/\u0000/g, "").slice(0, max).trim();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // Plan gating
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", user.id)
      .maybeSingle();

    if (!isAllowedPlan(profile?.plan_code)) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Disponible solo para planes Plus y Deluxe." }, { status: 403 });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const body = sanitize(bodyJson?.body, 10000);
    if (!body || body.length < 1) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    // Verificar que el mensaje pertenece al vendedor autenticado (RLS igual protege)
    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .select("id, seller_id, status, sender_email")
      .eq("id", params.id)
      .maybeSingle();

    if (msgErr) return NextResponse.json({ error: "DB_ERROR", details: msgErr.message }, { status: 500 });
    if (!msg || msg.seller_id !== user.id) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Insertar respuesta
    const { data: ins, error: insErr } = await supabase
      .from("message_replies")
      .insert({ message_id: params.id, sender_id: user.id, body })
      .select("id, created_at, message_id, body, sender_id")
      .maybeSingle();

    if (insErr) return NextResponse.json({ error: "DB_INSERT_ERROR", details: insErr.message }, { status: 500 });

    // Actualizar estado del mensaje a replied
    const { data: upd, error: updErr } = await supabase
      .from("messages")
      .update({ status: "replied" })
      .eq("id", params.id)
      .select("id, seller_id, status")
      .maybeSingle();

    if (updErr) return NextResponse.json({ error: "DB_UPDATE_ERROR", details: updErr.message }, { status: 500 });

    // Emitir eventos Pusher para refrescar UI en tiempo real
    try {
      const pusher = getPusher();
      await pusher.trigger(`private-seller-${upd?.seller_id}` as string, "message:updated", { id: upd?.id, status: "replied" });
      if (ins) {
        await pusher.trigger(`private-seller-${upd?.seller_id}` as string, "reply:new", {
          id: ins.id,
          created_at: ins.created_at,
          message_id: ins.message_id,
          body: ins.body,
          sender_id: ins.sender_id,
        });
        // Emitir al canal del comprador para realtime comprador
        const buyerEmail = (msg as any)?.sender_email as string | undefined;
        if (buyerEmail) {
          await pusher.trigger(
            `private-thread-${upd?.seller_id}-${emailSlug(buyerEmail)}` as string,
            "reply:new",
            {
              id: ins.id,
              created_at: ins.created_at,
              message_id: ins.message_id,
              body: ins.body,
              sender_id: ins.sender_id,
            }
          );
        }
      }
    } catch (ev) {
      console.warn("[/api/messages/[id]/reply] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, reply_id: ins?.id, created_at: ins?.created_at });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}
