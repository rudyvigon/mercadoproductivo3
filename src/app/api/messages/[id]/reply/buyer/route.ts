import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function sanitize(str: unknown, max = 10000) {
  return String(str ?? "").replace(/\u0000/g, "").slice(0, max).trim();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supa = createRouteClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const bodyJson = await req.json().catch(() => ({}));
    const body = sanitize(bodyJson?.body, 10000);
    if (!body || body.length < 1) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

    const admin = createAdminClient();

    // Verificar que el mensaje corresponde al comprador autenticado (por email)
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, seller_id, sender_email")
      .eq("id", params.id)
      .maybeSingle();

    if (msgErr) return NextResponse.json({ error: "DB_ERROR", details: msgErr.message }, { status: 500 });
    if (!msg) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if ((msg as any).sender_email !== (user.email || "")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    // Evitar que un usuario responda a un hilo cuyo vendedor sea él mismo
    if ((msg as any).seller_id === user.id) {
      return NextResponse.json(
        { error: "CANNOT_MESSAGE_SELF", message: "No puedes enviarte mensajes a ti mismo." },
        { status: 400 }
      );
    }

    // Insertar reply del comprador
    const { data: ins, error: insErr } = await admin
      .from("message_replies")
      .insert({ message_id: params.id, sender_id: user.id, body })
      .select("id, created_at, message_id, body, sender_id")
      .maybeSingle();

    if (insErr) return NextResponse.json({ error: "DB_INSERT_ERROR", details: insErr.message }, { status: 500 });

    // Actualizar estado del mensaje a "new" para que el vendedor lo vea como nuevo
    await admin.from("messages").update({ status: "new" }).eq("id", params.id);

    // Emitir a vendedor y comprador
    try {
      const p = getPusher();
      await p.trigger(`private-seller-${(msg as any).seller_id}` as string, "reply:new", ins as any);
      await p.trigger(
        `private-thread-${(msg as any).seller_id}-${emailSlug(user.email || "")}` as string,
        "reply:new",
        ins as any
      );
    } catch (ev) {
      console.warn("[/api/messages/[id]/reply/buyer] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, reply_id: ins?.id });
  } catch (e: any) {
    console.error("[/api/messages/[id]/reply/buyer] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
