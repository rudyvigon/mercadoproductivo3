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

    const { data: rep, error: repErr } = await admin
      .from("message_replies")
      .select("id, delivery_status, message_id, sender_id")
      .eq("id", params.id)
      .maybeSingle();

    if (repErr) return NextResponse.json({ error: "DB_ERROR", details: repErr.message }, { status: 500 });
    if (!rep) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, seller_id, sender_email")
      .eq("id", (rep as any).message_id)
      .maybeSingle();

    if (msgErr) return NextResponse.json({ error: "DB_ERROR", details: msgErr.message }, { status: 500 });
    if (!msg) return NextResponse.json({ error: "NOT_FOUND_MESSAGE" }, { status: 404 });

    const isSellerReply = (rep as any).sender_id === (msg as any).seller_id;

    // Solo el receptor puede marcar read
    if (isSellerReply) {
      // receptor: comprador (por email)
      if ((user.email || "").toLowerCase() !== String((msg as any).sender_email || "").toLowerCase()) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    } else {
      // reply del comprador -> receptor: vendedor
      if ((msg as any).seller_id !== user.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }

    // Idempotente
    if ((rep as any).delivery_status === "read") {
      return NextResponse.json({ ok: true, delivery_status: "read" });
    }

    const { data: upd, error: updErr } = await admin
      .from("message_replies")
      .update({ delivery_status: "read" })
      .eq("id", params.id)
      .neq("delivery_status", "read")
      .select("id, delivery_status")
      .maybeSingle();

    if (updErr) return NextResponse.json({ error: "DB_UPDATE_ERROR", details: updErr.message }, { status: 500 });
    // Emitir evento según el emisor de la reply
    try {
      const p = getPusher();
      const sellerId = (msg as any).seller_id as string;
      const buyerEmail = (msg as any).sender_email as string;
      if (isSellerReply) {
        // Reply del vendedor -> receptor comprador marcó read => actualizar UI del vendedor (outgoing)
        if (sellerId) {
          await p.trigger(`private-seller-${sellerId}` as string, "reply:read", {
            id: params.id,
            delivery_status: "read",
          });
        }
      } else {
        // Reply del comprador -> receptor vendedor marcó read => actualizar UI del comprador (outgoing)
        if (sellerId && buyerEmail) {
          await p.trigger(`private-thread-${sellerId}-${emailSlug(buyerEmail)}` as string, "reply:read", {
            id: params.id,
            delivery_status: "read",
          });
        }
      }
    } catch (ev) {
      console.warn("[/api/replies/[id]/read] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, delivery_status: upd?.delivery_status || "read" });
  } catch (e: any) {
    console.error("[/api/replies/[id]/read] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
