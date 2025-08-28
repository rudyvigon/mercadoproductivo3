import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const url = new URL(req.url);
    const page = clamp(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1, 1000000);
    const pageSize = clamp(parseInt(url.searchParams.get("pageSize") || "10", 10) || 10, 1, 100);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // 1) Traer todos los mensajes del comprador agrupables por vendedor
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, created_at, seller_id")
      .eq("sender_email", user.email)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "DB_ERROR", details: error.message }, { status: 500 });
    }

    const messageIds = (msgs || []).map((m) => m.id);
    const sellerIds = Array.from(new Set((msgs || []).map((m) => m.seller_id).filter(Boolean)));

    // 2) Traer replies asociados a esos mensajes para conocer última actividad
    let replies: { id: string; created_at: string; message_id: string }[] = [];
    if (messageIds.length > 0) {
      const { data: reps, error: repErr } = await supabase
        .from("message_replies")
        .select("id, created_at, message_id")
        .in("message_id", messageIds);
      if (!repErr) replies = reps || [];
    }

    // 3) Traer perfiles de vendedores para datos del encabezado (avatar/nombre/plan)
    let sellers: { id: string; avatar_url: string | null; company: string | null; plan_code: string | null; plan_label: string | null }[] = [];
    if (sellerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, avatar_url, company, plan_code, plan_label")
        .in("id", sellerIds);
      sellers = profs || [];
    }

    const sellerMap = new Map<string, { id: string; avatar_url: string | null; company: string | null; plan_code: string | null; plan_label: string | null }>();
    sellers.forEach((s) => sellerMap.set(s.id, s));

    // 4) Reducir a conversaciones por seller_id con última actividad
    type Conv = {
      seller_id: string;
      seller_company: string | null;
      seller_avatar_url: string | null;
      plan_code: string | null;
      plan_label: string | null;
      total_messages: number;
      last_message_at: string | null;
      last_reply_at: string | null;
      last_activity_at: string | null;
    };

    const convMap = new Map<string, Conv>();

    (msgs || []).forEach((m) => {
      const c = convMap.get(m.seller_id) || {
        seller_id: m.seller_id,
        seller_company: sellerMap.get(m.seller_id)?.company ?? null,
        seller_avatar_url: sellerMap.get(m.seller_id)?.avatar_url ?? null,
        plan_code: sellerMap.get(m.seller_id)?.plan_code ?? null,
        plan_label: sellerMap.get(m.seller_id)?.plan_label ?? null,
        total_messages: 0,
        last_message_at: null,
        last_reply_at: null,
        last_activity_at: null,
      };
      c.total_messages += 1;
      if (!c.last_message_at || new Date(m.created_at).getTime() > new Date(c.last_message_at).getTime()) {
        c.last_message_at = m.created_at;
      }
      convMap.set(m.seller_id, c);
    });

    const msgById = new Map((msgs || []).map((m) => [m.id, m.seller_id] as const));
    replies.forEach((r) => {
      const sid = msgById.get(r.message_id);
      if (!sid) return;
      const c = convMap.get(sid);
      if (!c) return;
      if (!c.last_reply_at || new Date(r.created_at).getTime() > new Date(c.last_reply_at).getTime()) {
        c.last_reply_at = r.created_at;
      }
    });

    const conversations = Array.from(convMap.values()).map((c) => ({
      ...c,
      last_activity_at: [c.last_message_at, c.last_reply_at].filter(Boolean).sort().slice(-1)[0] || c.last_message_at || c.last_reply_at || null,
    }));

    // 5) Filtrar por q (en company) si aplica
    let filtered = conversations;
    if (q) {
      filtered = conversations.filter((c) => (c.seller_company || "vendedor").toLowerCase().includes(q));
    }

    // 6) Ordenar por última actividad desc y paginar
    filtered.sort((a, b) => new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime());

    const total = filtered.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const pageItems = filtered.slice(from, to);

    return NextResponse.json({ items: pageItems, total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}
