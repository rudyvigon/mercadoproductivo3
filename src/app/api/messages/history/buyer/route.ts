import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function sanitize(str: string | null, max = 5000) {
  return String(str || "").replace(/\u0000/g, "").slice(0, max).trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = sanitize(searchParams.get("sellerId"), 64);
    if (!sellerId) return NextResponse.json({ error: "MISSING_SELLER_ID" }, { status: 400 });

    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // Buscar todos los mensajes de este comprador (por email) con este vendedor
    const email = user.email || "";
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, created_at, seller_id, sender_name, sender_email, sender_phone, subject, body, status, delivery_status")
      .eq("seller_id", sellerId)
      .eq("sender_email", email)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[messages/history/buyer] select error", error);
      return NextResponse.json({ error: "DB_SELECT_ERROR" }, { status: 500 });
    }

    const messageIds = (msgs || []).map((m) => m.id);
    let replies: { id: string; created_at: string; body: string; message_id: string; sender_id: string; delivery_status?: "sent" | "delivered" | "read" }[] = [];
    if (messageIds.length > 0) {
      const { data: reps, error: repErr } = await supabase
        .from("message_replies")
        .select("id, created_at, body, message_id, sender_id, delivery_status")
        .in("message_id", messageIds);
      if (repErr) {
        console.warn("[messages/history/buyer] replies select warn", repErr.message);
      } else {
        replies = reps || [];
      }
    }

    type ChatItem = {
      id: string;
      type: "incoming" | "outgoing";
      message_id?: string;
      body: string;
      created_at: string;
      sender_name?: string;
      sender_email?: string;
      delivery_status?: "sent" | "delivered" | "read";
    };

    // Para el comprador: los mensajes suyos son outgoing, las respuestas del vendedor son incoming
    // Filtrar placeholders (body vacío)
    const outgoing: ChatItem[] = (msgs || [])
      .filter((m) => {
        const bt = (m.body || "").trim();
        // Excluir placeholder creado por start-by-seller (body '—' + status 'replied')
        if (bt === "—" && String(m.status) === "replied") return false;
        return bt.length > 0;
      })
      .map((m) => ({
        id: `msg-${m.id}`,
        type: "outgoing",
        message_id: m.id,
        body: m.body,
        created_at: m.created_at,
        sender_name: m.sender_name,
        sender_email: m.sender_email,
        delivery_status: (m as any).delivery_status || "sent",
      }));
    const incomingReps: ChatItem[] = (replies || [])
      .filter((r) => String(r.sender_id || "") === String(sellerId))
      .map((r) => ({
        id: `rep-${r.id}`,
        type: "incoming",
        message_id: r.message_id,
        body: r.body,
        created_at: r.created_at,
      }));
    const outgoingReps: ChatItem[] = (replies || [])
      .filter((r) => String(r.sender_id || "") !== String(sellerId))
      .map((r) => ({
        id: `rep-${r.id}`,
        type: "outgoing",
        message_id: r.message_id,
        body: r.body,
        created_at: r.created_at,
        delivery_status: (r as any).delivery_status || "sent",
      }));

    const timeline = [...incomingReps, ...outgoingReps, ...outgoing].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return NextResponse.json({ items: msgs || [], replies, timeline });
  } catch (e) {
    console.error("[messages/history/buyer] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

