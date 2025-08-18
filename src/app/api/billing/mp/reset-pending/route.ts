import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const supabase = createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createAdminClient();
    const body = await req.json().catch(() => ({} as any));

    // Reset solo del usuario autenticado
    const resetSelf = async () => {
      const { error } = await admin
        .from("profiles")
        .update({ plan_pending_code: null, plan_pending_effective_at: null })
        .eq("id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "self" });
    };

    // Reset global (solo en desarrollo y con flag explícita)
    const allowGlobal = process.env.NODE_ENV !== "production" && process.env.BILLING_DEV_RESET_ALL === "true";
    const wantsAll = !!body?.all;

    if (wantsAll) {
      if (!allowGlobal) {
        return NextResponse.json({ error: "FORBIDDEN", details: "Global reset disabled" }, { status: 403 });
      }
      const { error, count } = await admin
        .from("profiles")
        .update({ plan_pending_code: null, plan_pending_effective_at: null })
        .is("plan_pending_code", null) // trick to enable returning minimal count isn't supported; do a second query if needed
        .select("id", { count: "estimated", head: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Ejecutar el update real (sin el filtro is null): limpiamos donde haya pendientes
      const { error: updErr } = await admin
        .from("profiles")
        .update({ plan_pending_code: null, plan_pending_effective_at: null })
        .not("plan_pending_code", "is", null);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, scope: "all", estimatedAffected: count ?? null });
    }

    return await resetSelf();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected Error" }, { status: 500 });
  }
}
