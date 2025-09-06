import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getSenderDisplayName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
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

    // Cargamos conversaciones con el RPC existente para reutilizar enriquecimiento y campos (preview, last_created_at, unread_count)
    const { data, error } = await supabase.rpc("chat_list_conversations", {
      p_user: user.id,
      p_include_hidden: false,
    });
    if (error) {
      return NextResponse.json({ error: "RPC_ERROR", message: error.message }, { status: 500 });
    }

    const conversations = Array.isArray(data) ? data : [];

    // Sumar no leídos (null o indefinidos cuentan como 0)
    const unread_count = conversations.reduce((acc: number, row: any) => {
      const v = Number(row?.unread_count);
      return acc + (Number.isFinite(v) ? Math.max(0, v) : 0);
    }, 0);

    // Mapear recientes a una estructura ligera usada por el cliente de notificaciones
    const recent_threads = conversations
      .map((row: any) => {
        const created_at: string = String(row?.last_created_at || "").trim() || new Date(0).toISOString();
        const name = getSenderDisplayName(
          undefined,
          String(row?.counterparty_name || "").trim() || undefined
        );
        return {
          id: String(row?.id || ""),
          created_at,
          seller_id: String(row?.counterparty_id || ""),
          sender_name: name,
          subject: String(row?.preview || "").trim() || "Nuevo mensaje",
          body: undefined as string | undefined,
        };
      })
      .filter((it: any) => it.id)
      .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .slice(0, 15);

    return NextResponse.json({ unread_count, recent_threads });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
