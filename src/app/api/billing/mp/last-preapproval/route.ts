import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("billing_events")
    .select("id, kind, payload, created_at")
    .eq("user_id", user.id)
    .eq("kind", "preapproval_created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const preapprovalId = (event as any)?.payload?.preapproval_id || null;
  return NextResponse.json({ ok: true, preapproval_id: preapprovalId });
}
