import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/public/site/banners?limit=3&folder=imagessite
// Devuelve un arreglo de URLs firmadas de imágenes para el slider
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const folder = url.searchParams.get("folder") || "imagessite"; // carpeta por defecto

  const limit = Math.max(1, Math.min(10, Number(limitParam) || 3));

  try {
    const admin = createAdminClient();

    // Listar archivos en el folder del bucket 'site'
    const { data: listed, error: listError } = await admin.storage
      .from("site")
      .list(folder, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      return NextResponse.json(
        { error: "No se pudieron listar las imágenes", details: listError.message },
        { status: 500 }
      );
    }

    const files = (listed || []).filter((f) => !f.name.startsWith("."));

    // Priorizar por prefijos conocidos (imagensite1..3) y luego completar con el resto
    const desiredPrefixes = ["imagensite1", "imagensite2", "imagensite3"]; // por defecto
    const remaining = [...files];
    const selected: typeof files = [];

    for (const pref of desiredPrefixes) {
      const idx = remaining.findIndex((f) => f.name.toLowerCase().startsWith(pref.toLowerCase()));
      if (idx !== -1) {
        selected.push(remaining[idx]);
        remaining.splice(idx, 1);
      }
      if (selected.length >= limit) break;
    }

    // Completar hasta el límite con los restantes en orden ascendente por nombre
    remaining.sort((a, b) => a.name.localeCompare(b.name));
    for (const f of remaining) {
      if (selected.length >= limit) break;
      selected.push(f);
    }

    // Generar URLs firmadas (1 hora)
    const signedUrls: string[] = [];
    for (const f of selected) {
      const { data, error } = await admin.storage
        .from("site")
        .createSignedUrl(`${folder}/${f.name}`, 60 * 60);
      if (error) {
        // Si falla firmar, continuar con el siguiente
        continue;
      }
      if (data?.signedUrl) signedUrls.push(data.signedUrl);
    }

    // Respuesta
    const res = NextResponse.json({ images: signedUrls });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.headers.set("CDN-Cache-Control", "s-maxage=300");
    res.headers.set("Vercel-CDN-Cache-Control", "s-maxage=300");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error inesperado", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
