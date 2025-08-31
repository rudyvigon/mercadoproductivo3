import { NextRequest, NextResponse } from "next/server";
// Mensajería deshabilitada temporalmente: este endpoint responde 410

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: "CHAT_DESHABILITADO", message: "Mensajería en reconstrucción. /api/messages está temporalmente inactivo." },
    { status: 410 }
  );
}
