import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const columns = [
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
      .select(columns)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "QUERY_ERROR",
          message: (error as any)?.message || "No se pudo obtener el perfil del vendedor",
          code: (error as any)?.code ?? null,
          details: (error as any)?.details ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Vendedor no encontrado" }, { status: 404 });
    }

    const first = (data.first_name || "").trim();
    const last = (data.last_name || "").trim();
    const full_name = (data.full_name || `${first} ${last}`.trim()) || "Vendedor";
    const location = data.city && data.province ? `${data.city}, ${data.province}` : null;
    const plan_label = planCodeToLabel(data.plan_code);
    const created_at = data.updated_at ?? data.plan_activated_at ?? null;

    return NextResponse.json(
      {
        seller: {
          id: data.id,
          first_name: data.first_name ?? null,
          last_name: data.last_name ?? null,
          full_name,
          company: data.company ?? null,
          city: data.city ?? null,
          province: data.province ?? null,
          location,
          avatar_url: data.avatar_url ?? null,
          created_at,
          plan_code: data.plan_code ?? null,
          plan_label,
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
