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

    type ProfileRow = {
      id: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      company: string | null;
      city: string | null;
      province: string | null;
      avatar_url: string | null;
      updated_at: string | null;
      plan_activated_at: string | null;
      plan_code: string | null;
    };

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

    const row = data as unknown as ProfileRow;
    const first = (row.first_name || "").trim();
    const last = (row.last_name || "").trim();
    const full_name = (row.full_name || `${first} ${last}`.trim()) || "Vendedor";
    const location = row.city && row.province ? `${row.city}, ${row.province}` : null;
    const plan_label = planCodeToLabel(row.plan_code);
    const created_at = row.updated_at ?? row.plan_activated_at ?? null;

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
          plan_code: row.plan_code ?? null,
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
