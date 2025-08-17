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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10) || 20));
    const orderBy = (url.searchParams.get("order_by") || "products_count").toLowerCase();
    const orderDir = (url.searchParams.get("order_dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const allowedOrder = new Set(["products_count", "updated_at", "joined_at"]);
    const orderColumn = allowedOrder.has(orderBy) ? orderBy : "products_count";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createAdminClient();

    // Cargar nombres de planes desde base para mapear plan_code -> name
    const { data: planRows } = await supabase
      .from("plans")
      .select("code, name");
    const planNameByCode = new Map(
      (planRows || []).map((p: any) => [String(p?.code || "").toLowerCase(), p?.name || null])
    );

    const selectColumns = [
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

    const { data, error, count } = await supabase
      .from("v_seller_stats")
      .select(selectColumns, { count: "exact" })
      .order(orderColumn, { ascending: orderDir === "asc" })
      .range(from, to);

    if (error) {
      return NextResponse.json(
        { error: "QUERY_ERROR", message: (error as any)?.message || "No se pudo obtener el listado de vendedores" },
        { status: 500 }
      );
    }

    const items = (data || []).map((row: any) => {
      const name = (row.company || row.full_name || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Vendedor").toString();
      const codeLower = String(row.plan_code || "").toLowerCase();
      const planName = planNameByCode.get(codeLower) || null;
      return {
        id: row.seller_id,
        name,
        avatar_url: row.avatar_url ?? null,
        plan_code: row.plan_code ?? null,
        plan_label: planName || planCodeToLabel(row.plan_code),
        joined_at: row.joined_at,
        products_count: row.products_count ?? 0,
        city: row.city ?? null,
        province: row.province ?? null,
        updated_at: row.updated_at,
      };
    });

    const total = count || 0;
    const total_pages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json(
      { items, page, page_size: pageSize, total, total_pages },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
