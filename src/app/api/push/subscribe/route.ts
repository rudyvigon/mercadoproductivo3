import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const json = await req.json().catch(() => ({}));
    const endpoint = String(json?.endpoint || "").trim();
    const keys = (json?.keys || {}) as { p256dh?: string; auth?: string };
    if (!endpoint) return NextResponse.json({ error: "ENDPOINT_REQUIRED" }, { status: 400 });

    const payload = {
      user_id: user.id,
      endpoint,
      p256dh: keys?.p256dh || null,
      auth: keys?.auth || null,
    } as any;

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: "UPSERT_FAILED", message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const json = await req.json().catch(() => ({}));
    const endpoint = String(json?.endpoint || "").trim();
    if (!endpoint) return NextResponse.json({ error: "ENDPOINT_REQUIRED" }, { status: 400 });

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: "DELETE_FAILED", message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
