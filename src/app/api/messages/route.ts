import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic";
}

function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const ALLOWED_STATUSES = new Set(["new", "read", "replied", "archived", "spam", "blocked"]);

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // Gating por plan (solo Plus o Deluxe)
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", user.id)
      .maybeSingle();

    if (!isAllowedPlan(profile?.plan_code)) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Disponible solo para planes Plus y Deluxe." }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = clamp(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1, 1000000);
    const pageSize = clamp(parseInt(url.searchParams.get("pageSize") || "10", 10) || 10, 1, 100);
    const status = (url.searchParams.get("status") || "").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("messages")
      .select("id, created_at, updated_at, seller_id, sender_name, sender_email, sender_phone, subject, body, status", { count: "exact" })
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status && ALLOWED_STATUSES.has(status)) {
      query = query.eq("status", status);
    }

    if (q) {
      const encoded = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
      query = query.or(
        `subject.ilike.%${encoded}%,body.ilike.%${encoded}%,sender_name.ilike.%${encoded}%`
      );
    }

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", message: e?.message || "" }, { status: 500 });
  }
}
