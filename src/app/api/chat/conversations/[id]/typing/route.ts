import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getPusher } from "@/lib/pusher/server";

// Rate limit in-memory por usuario+conversación (ventana ~1s)
const typingRateMap: Map<string, number> = new Map();

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: { id: string } }) {
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

    const json = await req.json().catch(() => ({}));
    const typing = Boolean(json?.typing);
    const nowIso = new Date().toISOString();

    // Aplicar rate limiting (1s) por usuario+conversación
    try {
      const key = `${user.id}:${conversationId}`;
      const last = typingRateMap.get(key) || 0;
      const now = Date.now();
      if (now - last < 1000) {
        // Dentro de la ventana: responder ok sin emitir
        return NextResponse.json({ ok: true, throttled: true });
      }
      typingRateMap.set(key, now);
      // Limpieza best-effort de entradas viejas
      if (typingRateMap.size > 5000) {
        typingRateMap.forEach((v, k) => {
          if (now - v > 60000) typingRateMap.delete(k);
        });
      }
    } catch {}

    try {
      const p = getPusher();
      await p.trigger(`private-conversation-${conversationId}`, "chat:typing", {
        conversation_id: conversationId,
        user_id: user.id,
        typing,
        at: nowIso,
      });
    } catch (e) {
      // swallow
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
