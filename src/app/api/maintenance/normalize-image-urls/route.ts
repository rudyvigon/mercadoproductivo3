import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { pathFromPublicUrl, getPublicUrlForPath } from "@/lib/images";

export async function POST() {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Obtener productos del usuario actual
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id")
    .eq("user_id", user.id);
  if (productsError) return NextResponse.json({ error: productsError.message }, { status: 500 });

  const productIds = (products ?? []).map((p: any) => p.id);
  if (productIds.length === 0) return NextResponse.json({ updated: 0 });

  // Traer imágenes de esos productos
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("id,url,product_id")
    .in("product_id", productIds);
  if (imagesError) return NextResponse.json({ error: imagesError.message }, { status: 500 });

  let updated = 0;
  for (const row of images ?? []) {
    const path = row.url ? pathFromPublicUrl(row.url) : null;
    if (!path) continue;
    const newUrl = getPublicUrlForPath(supabase, "product-images", path);
    if (newUrl && newUrl !== row.url) {
      const { error: updError } = await supabase
        .from("product_images")
        .update({ url: newUrl })
        .eq("id", row.id)
        .eq("product_id", row.product_id);
      if (!updError) updated++;
    }
  }

  return NextResponse.json({ updated });
}
