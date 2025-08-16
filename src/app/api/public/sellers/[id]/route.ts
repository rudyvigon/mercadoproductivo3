import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function planCodeToLabel(code?: string | null) {
  const c = String(code || "").toLowerCase();
  if (c === "free" || c === "basic") return "Básico";
  if (c === "plus" || c === "enterprise") return "Plus";
  if (c === "premium" || c === "pro") return "Premium";
  return "Básico";
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "MISSING_ID", message: "Falta el parámetro id" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        {
          error: "MISSING_ENV",
          message: "Faltan variables de entorno para Supabase (URL o SERVICE_ROLE_KEY)",
          hasUrl: !!url,
          hasServiceKey: !!serviceKey,
        },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();

    // Intentar obtener desde la vista optimizada con estadísticas
    const viewCols = [
      "seller_id",
      "first_name",
      "last_name",
      "full_name",
      "company",
      "city",
      "province",
      "avatar_url",
      "plan_code",
      "joined_at",
      "products_count",
      "updated_at",
    ].join(", ");

    const { data: viewRow, error: viewError } = await supabase
      .from("v_seller_stats")
      .select(viewCols)
      .eq("seller_id", id)
      .single();

    if (!viewError && viewRow) {
      const row: any = viewRow;
      const first = (row.first_name || "").trim();
      const last = (row.last_name || "").trim();
      const full_name = (row.full_name || `${first} ${last}`.trim()) || "Vendedor";
      const location = row.city && row.province ? `${row.city}, ${row.province}` : null;
      const plan_label = planCodeToLabel(row.plan_code);

      return NextResponse.json(
        {
          seller: {
            id,
            first_name: row.first_name ?? null,
            last_name: row.last_name ?? null,
            full_name,
            company: row.company ?? null,
            city: row.city ?? null,
            province: row.province ?? null,
            location,
            avatar_url: row.avatar_url ?? null,
            created_at: row.joined_at ?? row.updated_at ?? null,
            joined_at: row.joined_at ?? null,
            plan_code: row.plan_code ?? null,
            plan_label,
            products_count: row.products_count ?? 0,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fallback a profiles + conteo de productos (compatibilidad)
    const profCols = [
      "id",
      "first_name",
      "last_name",
      "full_name",
      "company",
      "city",
      "province",
      "avatar_url",
      "updated_at",
      "plan_activated_at",
      "plan_code",
    ].join(", ");

    const { data, error } = await supabase
      .from("profiles")
      .select(profCols)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "QUERY_ERROR", message: (error as any)?.message || "No se pudo obtener el perfil del vendedor" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Vendedor no encontrado" }, { status: 404 });
    }

    const row = data as any;
    const first = (row.first_name || "").trim();
    const last = (row.last_name || "").trim();
    const full_name = (row.full_name || `${first} ${last}`.trim()) || "Vendedor";
    const location = row.city && row.province ? `${row.city}, ${row.province}` : null;
    const plan_label = planCodeToLabel(row.plan_code);
    const created_at = row.plan_activated_at ?? row.updated_at ?? null;

    // Conteo de productos
    const { count: products_count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id);

    return NextResponse.json(
      {
        seller: {
          id: row.id,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          full_name,
          company: row.company ?? null,
          city: row.city ?? null,
          province: row.province ?? null,
          location,
          avatar_url: row.avatar_url ?? null,
          created_at,
          joined_at: created_at,
          plan_code: row.plan_code ?? null,
          plan_label,
          products_count: products_count || 0,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
