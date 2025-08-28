import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getNormalizedRoleFromUser } from "@/lib/auth/role";

export async function POST(req: Request) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // Solo vendedores pueden destacar productos
    const role = getNormalizedRoleFromUser(user);
    if (role !== "seller") {
      return NextResponse.json({ error: "Prohibido: esta acción es solo para vendedores" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const productId = String(body?.productId || "").trim();
    const days = Number(body?.days ?? 0);

    if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });
    if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: "days inválido" }, { status: 400 });

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

    // Validar permiso del plan para destacar
    // Fallback permisivo: si no se puede determinar (p.ej. columna inexistente), permitir.
    let canFeature: boolean | null = null;
    try {
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("plan_code")
        .eq("id", user.id)
        .maybeSingle();
      if (!profErr) {
        const planCode = (profile?.plan_code || "").toString();
        if (planCode) {
          const { data: plan, error: planErr } = await supabase
            .from("plans")
            .select("can_feature")
            .eq("code", planCode)
            .maybeSingle();
          if (!planErr) {
            const val = (plan as any)?.can_feature;
            canFeature = typeof val === "boolean" ? val : true; // si no existe, permitir
          }
        }
      }
    } catch {
      canFeature = null;
    }
    if (canFeature === false) {
      return NextResponse.json({ error: "Tu plan actual no permite destacar productos" }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("sp_feature_product", {
      p_product: productId,
      p_days: days,
      // p_cost es opcional: el costo por día se determina en el servidor según el plan
      p_cost: null,
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

