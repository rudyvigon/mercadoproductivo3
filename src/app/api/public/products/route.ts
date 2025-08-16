import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createRouteClient();

  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10)));

    const search = (searchParams.get("search") || "").trim();
    const category = searchParams.get("category") || "all";
    const minPrice = parseFloat(searchParams.get("minPrice") || "0");
    const maxPrice = parseFloat(searchParams.get("maxPrice") || "999999999");
    const location = searchParams.get("location") || "all";
    const sortBy = searchParams.get("sortBy") || "newest";
    const onlyFeatured = (searchParams.get("onlyFeatured") || "false") === "true";
    const sellerId = searchParams.get("sellerId") || undefined;
    const excludeProductId = searchParams.get("excludeProductId") || undefined;
    const excludeSellerId = searchParams.get("excludeSellerId") || undefined;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .range(from, to);

    if (sellerId) {
      query = query.eq("user_id", sellerId);
    }

    if (excludeProductId) {
      query = query.neq("id", excludeProductId);
    }

    if (excludeSellerId) {
      query = query.neq("user_id", excludeSellerId);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
      );
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    if (minPrice > 0 || maxPrice < 999999999) {
      query = query.gte("price", minPrice).lte("price", maxPrice);
    }

    if (location && location !== "all") {
      query = query.eq("location", location);
    }

    if (onlyFeatured) {
      query = query.not("featured_until", "is", null).gte("featured_until", new Date().toISOString());
    }

    switch (sortBy) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "featured":
        query = query
          .order("featured_until", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
        break;
      case "alphabetical":
        query = query.order("title", { ascending: true });
        break;
      case "random":
        // No ordenar aquí; manejaremos el modo aleatorio más abajo sin rangos
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    // Modo aleatorio: rehacer consulta sin rangos, tomar candidatos, mezclar y recortar
    if (sortBy === "random") {
      let randomQuery = supabase
        .from("products")
        .select("*", { count: "exact" });

      if (sellerId) {
        randomQuery = randomQuery.eq("user_id", sellerId);
      }
      if (excludeProductId) {
        randomQuery = randomQuery.neq("id", excludeProductId);
      }
      if (excludeSellerId) {
        randomQuery = randomQuery.neq("user_id", excludeSellerId);
      }
      if (search) {
        randomQuery = randomQuery.or(
          `title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
        );
      }
      if (category && category !== "all") {
        randomQuery = randomQuery.eq("category", category);
      }
      if (minPrice > 0 || maxPrice < 999999999) {
        randomQuery = randomQuery.gte("price", minPrice).lte("price", maxPrice);
      }
      if (location && location !== "all") {
        randomQuery = randomQuery.eq("location", location);
      }
      if (onlyFeatured) {
        randomQuery = randomQuery
          .not("featured_until", "is", null)
          .gte("featured_until", new Date().toISOString());
      }

      const { data: candidates, error: rndError, count: rndCount } = await randomQuery.limit(200);
      if (rndError) {
        console.error("Supabase random query error:", rndError);
        return NextResponse.json({ error: rndError.message }, { status: 500 });
      }

      const items = (candidates || []).slice();
      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      const limited = items.slice(0, pageSize);

      // Enriquecer con imagen principal y perfil de vendedor
      let withImages = limited;
      if (limited.length > 0) {
        const ids = limited.map((p: any) => p.id);
        const userIds = Array.from(new Set(limited.map((p: any) => p.user_id)));

        const [{ data: images }, { data: profiles }] = await Promise.all([
          supabase
            .from("product_images")
            .select("product_id,url,id")
            .in("product_id", ids)
            .order("id", { ascending: true }),
          supabase
            .from("profiles")
            .select("id, first_name, last_name, city, province, company")
            .in("id", userIds),
        ]);

        const firstImageByProduct = new Map<string, string | null>();
        if (images) {
          for (const img of images as any[]) {
            if (!firstImageByProduct.has(img.product_id)) {
              firstImageByProduct.set(img.product_id, img.url);
            }
          }
        }

        const profileById = new Map<string, any>();
        if (profiles) {
          for (const prof of profiles as any[]) {
            profileById.set(prof.id, {
              first_name: prof.first_name,
              last_name: prof.last_name,
              city: prof.city,
              province: prof.province,
              company: prof.company,
            });
          }
        }

        withImages = limited.map((p: any) => ({
          ...p,
          primaryImageUrl: firstImageByProduct.get(p.id) ?? null,
          profiles: profileById.get(p.user_id) || {},
        }));
      }

      const total = rndCount || 0;

      return NextResponse.json({
        items: withImages,
        page,
        pageSize,
        total,
        hasMore: false,
      });
    }

    const { data: products, error, count } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = products || [];

    // Enriquecer con imagen principal y perfil de vendedor
    let withImages = items;
    if (items.length > 0) {
      const ids = items.map((p) => p.id);
      const userIds = Array.from(new Set(items.map((p) => p.user_id)));

      const [{ data: images }, { data: profiles }] = await Promise.all([
        supabase
          .from("product_images")
          .select("product_id,url,id")
          .in("product_id", ids)
          .order("id", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, city, province, company")
          .in("id", userIds),
      ]);

      const firstImageByProduct = new Map<string, string | null>();
      if (images) {
        for (const img of images as any[]) {
          if (!firstImageByProduct.has(img.product_id)) {
            firstImageByProduct.set(img.product_id, img.url);
          }
        }
      }

      const profileById = new Map<string, any>();
      if (profiles) {
        for (const prof of profiles as any[]) {
          profileById.set(prof.id, {
            first_name: prof.first_name,
            last_name: prof.last_name,
            city: prof.city,
            province: prof.province,
            company: prof.company,
          });
        }
      }

      withImages = items.map((p) => ({
        ...p,
        primaryImageUrl: firstImageByProduct.get(p.id) ?? null,
        profiles: profileById.get(p.user_id) || {},
      }));
    }

    const total = count || 0;
    const hasMore = from + withImages.length < total;

    return NextResponse.json({
      items: withImages,
      page,
      pageSize,
      total,
      hasMore,
    });
  } catch (e: any) {
    console.error("API products error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
