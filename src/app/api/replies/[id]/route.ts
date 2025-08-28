import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supa = createRouteClient();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();
    // Cargar reply
    const { data: rep, error: repErr } = await admin
      .from("message_replies")
      .select("id, message_id, sender_id, deleted_at")
      .eq("id", params.id)
      .maybeSingle();

    if (repErr) return NextResponse.json({ error: "DB_ERROR", details: repErr.message }, { status: 500 });
    if (!rep) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if ((rep as any).sender_id !== user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    if ((rep as any).deleted_at) {
      return NextResponse.json({ ok: true, id: params.id });
    }

    // Cargar mensaje para canales
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, seller_id, sender_email")
      .eq("id", (rep as any).message_id)
      .maybeSingle();
    if (msgErr) return NextResponse.json({ error: "DB_ERROR", details: msgErr.message }, { status: 500 });
    if (!msg) return NextResponse.json({ error: "MESSAGE_NOT_FOUND" }, { status: 404 });

    const { error: updErr } = await admin
      .from("message_replies")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq("id", params.id);

    if (updErr) return NextResponse.json({ error: "DB_UPDATE_ERROR", details: updErr.message }, { status: 500 });

    try {
      const p = getPusher();
      const payload = { id: params.id, message_id: (rep as any).message_id } as any;
      await p.trigger(`private-seller-${(msg as any).seller_id}` as string, "reply:deleted", payload);
      await p.trigger(
        `private-thread-${(msg as any).seller_id}-${emailSlug(String((msg as any).sender_email || ""))}` as string,
        "reply:deleted",
        payload
      );
    } catch (ev) {
      console.warn("[/api/replies/[id]] pusher trigger (deleted) failed", ev);
    }

    return NextResponse.json({ ok: true, id: params.id });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}
