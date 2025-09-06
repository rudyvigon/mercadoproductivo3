import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  try {
    const chatV2Enabled = process.env.FEATURE_CHAT_V2_ENABLED === "true";
    return NextResponse.json({ chatV2Enabled });
  } catch (e: any) {
    return NextResponse.json({ chatV2Enabled: false, error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
