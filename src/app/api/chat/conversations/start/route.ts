import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dmKeyForUsers } from "@/lib/chat/dm";
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

    const json = await req.json().catch(() => ({}));
    const participantId = String(json?.participantId || "").trim();
    if (!participantId) return NextResponse.json({ error: "PARTICIPANT_REQUIRED" }, { status: 400 });
    if (participantId === user.id) return NextResponse.json({ error: "CANNOT_DM_SELF" }, { status: 400 });

    const dmKey = dmKeyForUsers(user.id, participantId);

    const admin = createAdminClient();
    // Upsert conversación por dm_key
    const { data: convUpsert, error: convErr } = await admin
      .from("chat_conversations")
      .upsert({ dm_key: dmKey }, { onConflict: "dm_key" })
      .select("id")
      .single();
    if (convErr) return NextResponse.json({ error: "UPSERT_CONV_FAILED", message: convErr.message }, { status: 500 });

    const conversationId = convUpsert.id as string;

    // Asegurar membresías para ambos usuarios
    const { error: memErr } = await admin
      .from("chat_conversation_members")
      .upsert(
        [
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: participantId },
        ],
        { onConflict: "conversation_id,user_id" }
      );
    if (memErr)
      return NextResponse.json({ error: "UPSERT_MEMBERS_FAILED", message: memErr.message }, { status: 500 });

    // Emitir evento sólo al destinatario para refrescar su bandeja (evitar notificar al emisor)
    try {
      const p = getPusher();
      await p.trigger(
        `private-user-${participantId}`,
        "chat:conversation:started",
        { conversation_id: conversationId }
      );
    } catch (e) {
      // swallow
    }

    return NextResponse.json({ conversation_id: conversationId });
  } catch (e: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

