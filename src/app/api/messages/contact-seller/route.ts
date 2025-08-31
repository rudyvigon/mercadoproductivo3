import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export async function POST(_req: Request) {
  return NextResponse.json(
    { error: "CHAT_DESHABILITADO", message: "Mensajería en reconstrucción. /api/messages está temporalmente inactivo." },
    { status: 410 }
  );
}
