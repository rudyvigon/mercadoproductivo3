import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function gone() {
  return NextResponse.json(
    {
      error: "ENDPOINT_DEPRECATED",
      message: "El envío por email fue deshabilitado. Usa /api/messages/contact-seller.",
    },
    { status: 410 }
  );
}

export async function POST() { return gone(); }
export async function GET() { return gone(); }
export async function PUT() { return gone(); }
export async function DELETE() { return gone(); }
