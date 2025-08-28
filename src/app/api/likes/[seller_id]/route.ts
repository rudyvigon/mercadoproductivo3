import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isPaidPlan(plan?: string | null) {
  const c = String(plan || "").toLowerCase();
  return (
    c.includes("plus") ||
    c.includes("deluxe") ||
    c.includes("diamond") ||
    c === "premium" ||
    c === "pro" ||
    c === "enterprise"
  );
}

export async function GET(_req: Request, ctx: { params: { seller_id: string } }) {
  try {
    const sellerId = ctx?.params?.seller_id;
    if (!sellerId) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    const supabase = createRouteClient();

    const { data: countRows } = await supabase
      .from("v_profile_likes_count")
      .select("likes_count")
      .eq("seller_id", sellerId)
      .limit(1);
    const likes_count = countRows?.[0]?.likes_count ?? 0;

    const { data: auth } = await supabase.auth.getUser();
    let liked = false;
    if (auth?.user) {
      const { data: likedRows } = await supabase
        .from("profile_likes")
        .select("liker_user_id")
        .eq("liker_user_id", auth.user.id)
        .eq("target_seller_id", sellerId)
        .limit(1);
      liked = !!(likedRows && likedRows.length > 0);
    }

    return NextResponse.json({ likes_count, liked });
  } catch (e: any) {
    // Logueo de diagnóstico para identificar rápidamente la causa del 500
    console.error("[/api/likes] GET error", {
      sellerId: ctx?.params?.seller_id,
      message: e?.message,
      stack: e?.stack,
    });
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(_req: Request, ctx: { params: { seller_id: string } }) {
  try {
    const sellerId = ctx?.params?.seller_id;
    if (!sellerId) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    const supabase = createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Debe iniciar sesión para dar like" }, { status: 401 });
    }

    // Evitar self-like para no violar la constraint prevent_self_like
    if (user.id === sellerId) {
      return NextResponse.json({ error: "SELF_LIKE_FORBIDDEN", message: "No puedes darte like a ti mismo" }, { status: 400 });
    }

    // Verificar que el perfil objetivo es Plus/Deluxe (o sinónimos)
    const admin = createAdminClient();
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("plan_code")
      .eq("id", sellerId)
      .single();
    if (profErr || !profile) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Vendedor no encontrado" }, { status: 404 });
    }
    if (!isPaidPlan(profile.plan_code)) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Solo perfiles Plus o Deluxe pueden recibir likes" }, { status: 403 });
    }

    // Asegurar que el perfil del usuario que da like exista para no violar FK
    {
      const { error: ensureErr } = await admin
        .from("profiles")
        .upsert({ id: user.id }, { onConflict: "id" });
      if (ensureErr) {
        console.error("[/api/likes] ensure liker profile error", { userId: user.id, message: ensureErr.message });
        return NextResponse.json({ error: ensureErr.message || "No se pudo preparar el perfil del usuario" }, { status: 500 });
      }
    }

    // ¿Ya existe like?
    const { data: likedRows } = await supabase
      .from("profile_likes")
      .select("liker_user_id")
      .eq("liker_user_id", user.id)
      .eq("target_seller_id", sellerId)
      .limit(1);

    let liked = false;
    if (likedRows && likedRows.length > 0) {
      // Unlike
      const { error: delErr } = await supabase
        .from("profile_likes")
        .delete()
        .eq("liker_user_id", user.id)
        .eq("target_seller_id", sellerId);
      if (delErr) {
        console.error("[/api/likes] DELETE like error", { sellerId, userId: user.id, message: delErr.message });
        return NextResponse.json({ error: delErr.message || "No se pudo quitar el like" }, { status: 500 });
      }
      liked = false;
    } else {
      // Like
      const { error: insErr } = await supabase
        .from("profile_likes")
        .insert({ liker_user_id: user.id, target_seller_id: sellerId });
      if (insErr) {
        console.error("[/api/likes] INSERT like error", { sellerId, userId: user.id, message: insErr.message });
        const msg = insErr.message || "No se pudo dar like";
        if (msg.toLowerCase().includes("prevent_self_like")) {
          return NextResponse.json({ error: "SELF_LIKE_FORBIDDEN", message: "No puedes darte like a ti mismo" }, { status: 400 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      liked = true;
    }

    // Nuevo conteo
    const { data: countRows } = await supabase
      .from("v_profile_likes_count")
      .select("likes_count")
      .eq("seller_id", sellerId)
      .limit(1);
    const likes_count = countRows?.[0]?.likes_count ?? 0;

    return NextResponse.json({ liked, likes_count });
  } catch (e: any) {
    console.error("[/api/likes] POST error", {
      sellerId: ctx?.params?.seller_id,
      message: e?.message,
      stack: e?.stack,
    });
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

