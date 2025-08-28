import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supa = createRouteClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();

    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, seller_id, sender_email, body, status, delivery_status")
      .eq("id", params.id)
      .maybeSingle();

    if (msgErr) return NextResponse.json({ error: "DB_ERROR", details: msgErr.message }, { status: 500 });
    if (!msg) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Solo el vendedor (receptor del primer mensaje) puede marcar como leído
    if ((msg as any).seller_id !== user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Ignorar placeholder creado por start-by-seller
    const isPlaceholder = String((msg as any).body || "").trim() === "—" && String((msg as any).status) === "replied";
    if (isPlaceholder) return NextResponse.json({ ok: true, delivery_status: (msg as any).delivery_status || "sent" });

    // Idempotente: si ya está leído
    if ((msg as any).delivery_status === "read") {
      return NextResponse.json({ ok: true, delivery_status: "read" });
    }

    const { data: upd, error: updErr } = await admin
      .from("messages")
      .update({ delivery_status: "read" })
      .eq("id", params.id)
      .neq("delivery_status", "read")
      .select("id, delivery_status")
      .maybeSingle();

    if (updErr) return NextResponse.json({ error: "DB_UPDATE_ERROR", details: updErr.message }, { status: 500 });
    // Emitir evento al comprador para actualizar su UI (outgoing message status)
    try {
      const p = getPusher();
      const sellerId = (msg as any).seller_id as string;
      const buyerEmail = (msg as any).sender_email as string;
      if (sellerId && buyerEmail) {
        await p.trigger(`private-thread-${sellerId}-${emailSlug(buyerEmail)}` as string, "message:read", {
          id: params.id,
          delivery_status: "read",
        });
      }
    } catch (ev) {
      console.warn("[/api/messages/[id]/read] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, delivery_status: upd?.delivery_status || "read" });
  } catch (e: any) {
    console.error("[/api/messages/[id]/read] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
