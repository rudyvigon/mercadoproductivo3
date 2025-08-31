import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getPusher } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  if (process.env.FEATURE_CHAT_V2_ENABLED !== "true") {
    return NextResponse.json(
      { error: "CHAT_DESHABILITADO", message: "El sistema de chat v2 está temporalmente deshabilitado." },
      { status: 410 }
    );
  }
  try {
    const conversationId = String(ctx.params.id || "");
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // Verificar membresía
    const { data: mem, error: memErr } = await supabase
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr) return NextResponse.json({ error: "MEMBERSHIP_CHECK_FAILED" }, { status: 500 });
    if (!mem) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("chat_conversation_members")
      .update({ last_read_at: now, unread_count: 0 })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    if (upErr) return NextResponse.json({ error: "READ_FAILED", message: upErr.message }, { status: 500 });

    try {
      const p = getPusher();
      await p.trigger(`private-user-${user.id}`, "chat:conversation:read", { conversation_id: conversationId });
    } catch (e) {
      // swallow
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

