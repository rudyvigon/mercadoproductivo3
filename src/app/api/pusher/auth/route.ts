import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getPusher } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (process.env.FEATURE_CHAT_V2_ENABLED !== "true") {
    return NextResponse.json(
      { error: "CHAT_DESHABILITADO", message: "El sistema de chat v2 está temporalmente deshabilitado." },
      { status: 410 }
    );
  }

  try {
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // pusher-js (v8) puede enviar JSON camelCase (socketId/channelName) o snake_case (socket_id/channel_name)
    // además, contemplamos formData y cuerpos urlencoded. Importante: leer body una sola vez según Content-Type.
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let payload: any = {};
    try {
      if (ct.includes("application/json")) {
        payload = await req.json();
      } else if (ct.includes("multipart/form-data")) {
        const form = await req.formData();
        payload = Object.fromEntries(form.entries());
      } else if (ct.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text || "");
        payload = Object.fromEntries(params.entries());
      } else {
        // Intento final: leer texto y parsear si posible
        const text = await req.text();
        try {
          payload = JSON.parse(text);
        } catch {
          const params = new URLSearchParams(text || "");
          payload = Object.fromEntries(params.entries());
        }
      }
    } catch {
      // si algo falla, payload queda {}
    }

    const socketId = String(
      (payload?.socket_id ?? payload?.socketId ?? payload?.socketid ?? payload?.socket) || ""
    ).trim();
    const channelName = String(
      (payload?.channel_name ?? payload?.channelName ?? payload?.channel ?? payload?.channelname) || ""
    ).trim();
    if (!socketId || !channelName) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Faltan socket_id o channel_name" }, { status: 400 });
    }

    // Validación de canal privado
    if (!channelName.startsWith("private-")) {
      return NextResponse.json({ error: "BAD_CHANNEL", message: "Solo se permiten canales privados" }, { status: 400 });
    }

    if (channelName.startsWith("private-user-")) {
      const userId = channelName.replace("private-user-", "");
      if (userId !== user.id) {
        return NextResponse.json({ error: "FORBIDDEN", message: "No autorizado a este canal de usuario" }, { status: 403 });
      }
    } else if (channelName.startsWith("private-conversation-")) {
      const conversationId = channelName.replace("private-conversation-", "");
      const { data: mem, error: memErr } = await supabase
        .from("chat_conversation_members")
        .select("conversation_id")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (memErr) return NextResponse.json({ error: "MEMBERSHIP_CHECK_FAILED" }, { status: 500 });
      if (!mem) return NextResponse.json({ error: "FORBIDDEN", message: "No miembro de la conversación" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "UNKNOWN_CHANNEL", message: "Formato de canal no soportado" }, { status: 400 });
    }

    // Autorizar con Pusher server SDK
    const p = getPusher();
    const auth = p.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

