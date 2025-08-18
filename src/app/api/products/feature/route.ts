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
    const days = Number(body?.days ?? 3);
    const cost = Number(body?.cost ?? 10);

    if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });
    if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: "days inválido" }, { status: 400 });
    if (!Number.isFinite(cost) || cost <= 0) return NextResponse.json({ error: "cost inválido" }, { status: 400 });

    // Verificar propiedad del producto antes de ejecutar la RPC
    const { data: ownerRow, error: ownerErr } = await supabase
      .from("products")
      .select("user_id")
      .eq("id", productId)
      .single();
    if (ownerErr || !ownerRow) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (ownerRow.user_id !== user.id) {
      return NextResponse.json({ error: "Prohibido: no puedes modificar productos de otro usuario" }, { status: 403 });
    }

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
