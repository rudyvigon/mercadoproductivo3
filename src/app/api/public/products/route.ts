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

    // Construimos la query base SIN range para poder aplicar límites por plan
    // a todo el conjunto y recién luego paginar.
    let query = supabase
      .from("products")
      .select("*", { count: "exact" });

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

      let items = (candidates || []).slice();

      // Obtener planes de los vendedores y calcular límites por plan
      if (items.length > 0) {
        const userIdsAll = Array.from(new Set(items.map((p: any) => p.user_id)));
        const { data: sellerProfiles } = await supabase
          .from("profiles")
          .select("id, plan_code, first_name, last_name, city, province, company")
          .in("id", userIdsAll);

        const freeCodes = new Set(["gratis", "free", "basic"]);
        const plusCodes = new Set(["plus", "enterprise", "premium", "pro"]);
        const deluxeCodes = new Set(["deluxe", "diamond"]);
        const limitBySeller = new Map<string, number>();

        for (const sp of (sellerProfiles || []) as any[]) {
          const code = String(sp?.plan_code || "").toLowerCase();
          let limit = 999999; // sin límite práctico para otros planes
          if (freeCodes.has(code)) limit = 1;
          else if (plusCodes.has(code)) limit = 15;
          else if (deluxeCodes.has(code)) limit = 30;
          limitBySeller.set(sp.id, limit);
        }

        // Si es página de vendedor, ajustar límite por excludeProductId
        if (sellerId) {
          const currentLimit = limitBySeller.get(sellerId) ?? 999999;
          const allowed = Math.max(0, currentLimit - (excludeProductId ? 1 : 0));
          limitBySeller.set(sellerId, allowed);
        }

        // Fisher-Yates shuffle
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }

        // Aplicar límites por vendedor
        const usedBySeller = new Map<string, number>();
        const filtered: any[] = [];
        for (const p of items) {
          const uid = p.user_id as string;
          const limit = limitBySeller.get(uid) ?? 999999;
          const used = usedBySeller.get(uid) ?? 0;
          if (used >= limit) continue;
          usedBySeller.set(uid, used + 1);
          filtered.push(p);
        }
        items = filtered;

        // Limitar a pageSize luego del filtrado
        const limited = items.slice(0, pageSize);

        // Enriquecer con imagen principal y perfil de vendedor
        let withImages = limited;
        if (limited.length > 0) {
          const ids = limited.map((p: any) => p.id);

          const [{ data: images }] = await Promise.all([
            supabase
              .from("product_images")
              .select("product_id,url,id")
              .in("product_id", ids)
              .order("id", { ascending: true }),
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
          for (const sp of (sellerProfiles || []) as any[]) {
            profileById.set(sp.id, {
              first_name: sp.first_name,
              last_name: sp.last_name,
              city: sp.city,
              province: sp.province,
              company: sp.company,
              plan_code: sp.plan_code,
            });
          }

          withImages = limited.map((p: any) => ({
            ...p,
            primaryImageUrl: firstImageByProduct.get(p.id) ?? null,
            profiles: profileById.get(p.user_id) || {},
          }));
        }

        // Ajustar total: si hay sellerId, acotar por límite del plan (y -1 si excludeProductId)
        let effectiveTotal = rndCount || 0;
        if (sellerId) {
          const sellerLimit = limitBySeller.get(sellerId) ?? 999999;
          const cap = Math.max(0, sellerLimit - (excludeProductId ? 1 : 0));
          effectiveTotal = Math.min(effectiveTotal, cap);
        }
        const total = effectiveTotal;

        return NextResponse.json({
          items: withImages,
          page,
          pageSize,
          total,
          hasMore: false,
        });
      }

      // Sin candidatos
      return NextResponse.json({ items: [], page, pageSize, total: 0, hasMore: false });
    }

    const { data: products, error, count } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const candidates = products || [];

    // Si no hay candidatos, respuesta vacía
    if (candidates.length === 0) {
      return NextResponse.json({ items: [], page, pageSize, total: 0, hasMore: false });
    }

    // Cargar perfiles de los vendedores para conocer los límites por plan
    const userIdsAll = Array.from(new Set(candidates.map((p) => p.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, plan_code, first_name, last_name, city, province, company")
      .in("id", userIdsAll);

    const profileById = new Map<string, any>();
    for (const prof of (profiles || []) as any[]) {
      profileById.set(prof.id, prof);
    }

    const freeCodes = new Set(["gratis", "free", "basic"]);
    const plusCodes = new Set(["plus", "enterprise", "premium", "pro"]);
    const deluxeCodes = new Set(["deluxe", "diamond"]);
    const getSellerLimit = (uid: string) => {
      const code = String(profileById.get(uid)?.plan_code || "").toLowerCase();
      if (freeCodes.has(code)) return 1;
      if (plusCodes.has(code)) return 15;
      if (deluxeCodes.has(code)) return 30;
      return 999999; // otros planes: sin límite práctico
    };

    // Aplicar límites por plan ANTES de paginar
    let filteredAll = candidates as typeof candidates;
    if (sellerId) {
      // Página de vendedor
      const sellerItems = candidates.filter((p) => p.user_id === sellerId && (!excludeProductId || p.id !== excludeProductId));
      const limit = getSellerLimit(sellerId);
      const allowed = Math.max(0, limit);
      filteredAll = sellerItems.slice(0, allowed);
    } else {
      // Listado general: aplicar límite por vendedor según plan, manteniendo orden actual
      const usedBySeller = new Map<string, number>();
      const acc: typeof candidates = [] as any;
      for (const p of candidates) {
        const uid = p.user_id as string;
        const limit = getSellerLimit(uid);
        const used = usedBySeller.get(uid) ?? 0;
        if (used >= limit) continue;
        usedBySeller.set(uid, used + 1);
        acc.push(p);
      }
      filteredAll = acc;
    }

    // Total visible tras aplicar límite por plan
    const total = filteredAll.length;

    // Determinar página actual del conjunto filtrado
    const pageItems = filteredAll.slice(from, to + 1);

    // Enriquecer solo los items de la página con imágenes y perfil
    const ids = pageItems.map((p) => p.id);
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id,url,id")
      .in("product_id", ids)
      .order("id", { ascending: true });

    const firstImageByProduct = new Map<string, string | null>();
    if (images) {
      for (const img of images as any[]) {
        if (!firstImageByProduct.has(img.product_id)) {
          firstImageByProduct.set(img.product_id, img.url);
        }
      }
    }

    const withImages = pageItems.map((p) => ({
      ...p,
      primaryImageUrl: firstImageByProduct.get(p.id) ?? null,
      profiles: (() => {
        const prof = profileById.get(p.user_id) || {};
        return {
          first_name: prof.first_name,
          last_name: prof.last_name,
          city: prof.city,
          province: prof.province,
          company: prof.company,
          plan_code: prof.plan_code,
        };
      })(),
    }));

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
