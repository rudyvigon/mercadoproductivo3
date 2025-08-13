import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const productId = String(body?.productId || "").trim();
    const days = Number(body?.days ?? 7);
    const cost = Number(body?.cost ?? 10);

    if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });
    if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: "days inválido" }, { status: 400 });
    if (!Number.isFinite(cost) || cost <= 0) return NextResponse.json({ error: "cost inválido" }, { status: 400 });

    const { data, error } = await supabase.rpc("sp_feature_product", {
      p_product: productId,
      p_days: days,
      p_cost: cost,
    });
    if (error) {
      console.error("sp_feature_product error", {
        message: error.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      });
      return NextResponse.json(
        {
          error: error.message,
          code: (error as any)?.code ?? null,
          details: (error as any)?.details ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 400 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      remainingCredits: row?.remaining_credits ?? null,
      featuredUntil: row?.featured_until ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
