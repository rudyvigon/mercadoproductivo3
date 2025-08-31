import { NextRequest, NextResponse } from "next/server";
// Mensajería deshabilitada temporalmente: este endpoint responde 410

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

function sanitize(str: unknown, max = 10000) {
  return String(str ?? "").replace(/\u0000/g, "").slice(0, max).trim();
}

export async function POST(_req: NextRequest, _ctx: { params: { id: string } }) {
  return NextResponse.json(
    { error: "CHAT_DESHABILITADO", message: "Mensajería en reconstrucción. /api/messages está temporalmente inactivo." },
    { status: 410 }
  );
}

