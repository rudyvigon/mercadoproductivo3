import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set(["new", "read", "replied", "archived", "spam", "blocked"]);

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic";
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();
    // Cargar datos mínimos del mensaje
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, seller_id, sender_email, deleted_at")
      .eq("id", params.id)
      .maybeSingle();

    if (msgErr) return NextResponse.json({ error: "DB_ERROR", details: msgErr.message }, { status: 500 });
    if (!msg) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const senderEmail = String((msg as any).sender_email || "");
    // Solo el comprador (dueño del mensaje) puede borrar su mensaje
    if (!user.email || senderEmail.toLowerCase() !== (user.email || "").toLowerCase()) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    // Idempotencia: si ya está borrado, responder ok
    if ((msg as any).deleted_at) {
      return NextResponse.json({ ok: true, id: params.id });
    }

    const { data: upd, error: updErr } = await admin
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq("id", params.id)
      .select("id, seller_id, sender_email")
      .maybeSingle();

    if (updErr) return NextResponse.json({ error: "DB_UPDATE_ERROR", details: updErr.message }, { status: 500 });

    try {
      const pusher = getPusher();
      const payload = { id: params.id, sender_email: (upd as any)?.sender_email } as any;
      await pusher.trigger(`private-seller-${(upd as any)?.seller_id}` as string, "message:deleted", payload);
      await pusher.trigger(
        `private-thread-${(upd as any)?.seller_id}-${emailSlug(String((upd as any)?.sender_email || ""))}` as string,
        "message:deleted",
        payload
      );
    } catch (ev) {
      console.warn("[/api/messages/[id]] pusher trigger (deleted) failed", ev);
    }

    return NextResponse.json({ ok: true, id: params.id });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}

function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // RLS asegura acceso solo a registros del vendedor
    const { data, error } = await supabase
      .from("messages")
      .select("id, created_at, updated_at, seller_id, sender_name, sender_email, sender_phone, subject, body, status")
      .eq("id", params.id)
      .single();

    if (error) return NextResponse.json({ error: "DB_ERROR", details: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", user.id)
      .maybeSingle();

    if (!isAllowedPlan(profile?.plan_code)) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Disponible solo para planes Plus y Deluxe." }, { status: 403 });
    }

    const { status } = await req.json();
    if (!status || !ALLOWED_STATUSES.has(String(status).toLowerCase())) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("messages")
      .update({ status: String(status).toLowerCase() })
      .eq("id", params.id)
      .select("id, status, seller_id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: "DB_ERROR", details: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    // Emitir evento Pusher
    try {
      const pusher = getPusher();
      await pusher.trigger(`private-seller-${data.seller_id}` as string, "message:updated", { id: data.id, status: data.status });
    } catch (ev) {
      console.warn("[/api/messages/[id]] pusher trigger failed", ev);
    }

    return NextResponse.json({ ok: true, id: data.id, status: data.status });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}
