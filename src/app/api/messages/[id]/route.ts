import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getPusher } from "@/lib/pusher/server";

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
