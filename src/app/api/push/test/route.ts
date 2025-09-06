import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { trySendWebPush } from "@/lib/push/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "FORBIDDEN", message: "Endpoint de prueba deshabilitado en producción" }, { status: 403 });
    }

    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "LOAD_SUBS_FAILED", message: error.message }, { status: 500 });

    const payload = {
      title: "Prueba de notificación",
      body: "Este es un mensaje de prueba de Web Push",
      url: "/dashboard/messages",
      icon: "/favicon.ico",
    };

    const results: any[] = [];
    for (const s of subs || []) {
      const r = await trySendWebPush(s.endpoint, { p256dh: s.p256dh || undefined, auth: s.auth || undefined }, payload);
      results.push({ endpoint: s.endpoint, ok: r.ok, status: r.status ?? null });
    }

    return NextResponse.json({ sent: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
