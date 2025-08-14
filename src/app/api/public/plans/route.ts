import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.error("/api/public/plans missing env", { hasUrl: !!url, hasServiceKey: !!serviceKey });
      return NextResponse.json({
        error: "MISSING_ENV",
        message: "Faltan variables de entorno para Supabase (URL o SERVICE_ROLE_KEY)",
        hasUrl: !!url,
        hasServiceKey: !!serviceKey,
      }, { status: 500 });
    }
    const supabase = createAdminClient();
    // Intentamos incluir columnas opcionales relacionadas a precios y moneda si existen en la tabla
    const columnsFull = "code, name, max_products, max_images_per_product, credits_monthly, can_feature, feature_cost, price_monthly_cents, price_yearly_cents, currency, price_monthly, price_yearly";
    const { data, error } = await supabase
      .from("plans")
      .select(columnsFull)
      .order("code", { ascending: true });

    if (error) {
      // Fallback: intentar con columnas base (por si faltan can_feature/feature_cost)
      console.error("/api/public/plans error", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      });
      const columnsBase = "code, name, max_products, max_images_per_product, credits_monthly";
      const { data: dataBase, error: errorBase } = await supabase
        .from("plans")
        .select(columnsBase)
        .order("code", { ascending: true });
      if (!errorBase && Array.isArray(dataBase)) {
        const mapped = dataBase.map((r: any) => ({
          ...r,
          can_feature: null,
          feature_cost: null,
          price_monthly_cents: null,
          price_yearly_cents: null,
          currency: null,
          price_monthly: null,
          price_yearly: null,
        }));
        return NextResponse.json(
          { plans: mapped },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      // Intentar un HEAD con count para más diagnóstico
      let rowCount: number | null = null;
      try {
        const { count } = await supabase
          .from("plans")
          .select("code", { count: "exact", head: true });
        rowCount = typeof count === "number" ? count : null;
      } catch {}
      return NextResponse.json({
        error: "QUERY_ERROR",
        message: (errorBase || error as any)?.message || "No se pudieron cargar los planes",
        code: (errorBase || error as any)?.code ?? null,
        details: (errorBase || error as any)?.details ?? null,
        hint: (errorBase || error as any)?.hint ?? null,
        rowCount,
      }, { status: 500 });
    }

    return NextResponse.json(
      { plans: Array.isArray(data) ? data : [] },
      {
        headers: {
          // Evita cache en edge/cdn
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
