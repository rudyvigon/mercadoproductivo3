import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductGallery } from "@/components/products/product-gallery";
import { CalendarDays, MapPin, Package, ArrowLeft, Star, Tag } from "lucide-react";
import SellerMoreProducts from "@/components/products/seller-more-products";
import SimilarProducts from "@/components/products/similar-products";
import SellerInfoCard from "@/components/products/seller-info-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
  quantity_value: number;
  quantity_unit: string;
  featured_until?: string | null;
  created_at: string;
  user_id: string;
};

export default async function PublicProductPage({ params }: { params: { id: string } }) {
  if (!params?.id) notFound();

  const supabase = createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id,title,description,price,category,location,quantity_value,quantity_unit,featured_until,created_at,user_id"
    )
    .eq("id", params.id)
    .eq("published", true)
    .single();

  if (error || !product) {
    // Consola en server para depurar rápidamente si hiciera falta
    console.error("PublicProductPage product fetch error", error);
    notFound();
  }

  const isFeatured = Boolean(
    product.featured_until && new Date(product.featured_until) > new Date()
  );

  const price = Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(product.price ?? 0));

  const qty = `${Number(product.quantity_value)} ${product.quantity_unit}`;
  const createdAt = new Date(product.created_at).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Cargar imágenes del producto
  const { data: gallery } = await supabase
    .from("product_images")
    .select("url,id")
    .eq("product_id", product.id)
    .order("id", { ascending: true });
  const images = (gallery || []).map((g: any) => g.url as string);

  // Cargar perfil del vendedor desde endpoint público para mantener consistencia
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  let seller: any = null;
  try {
    const res = await fetch(`${baseUrl}/api/public/sellers/${product.user_id}`, { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      seller = payload?.seller || null;
    }
  } catch (e) {
    console.error("Failed to fetch seller info", e);
  }

  // Datos del vendedor se renderizan con SellerInfoCard

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" className="w-fit px-0 text-primary">
          <Link href="/" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver al marketplace
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Galería */}
        <div>
          <ProductGallery images={images} title={product.title} />
        </div>

        {/* Datos */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">{product.title}</h1>
            {isFeatured && (
              <Badge className="bg-orange-500 text-white">
                <Star className="mr-1 h-3 w-3" /> Destacado
              </Badge>
            )}
          </div>

          <div className="text-2xl font-bold text-gray-900">{price}</div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="h-4 w-4" /> {qty}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {product.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Publicado el {createdAt}
            </span>
            <span className="inline-flex items-center gap-1">
              <Tag className="h-4 w-4" /> {product.category}
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descripción</CardTitle>
              <CardDescription>
                Detalles del producto proporcionados por el vendedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">{product.description}</p>
            </CardContent>
          </Card>

          {/* Perfil del vendedor */}
          {seller && <SellerInfoCard productTitle={product.title} seller={{
            id: product.user_id,
            first_name: seller.first_name ?? null,
            last_name: seller.last_name ?? null,
            full_name: seller.full_name ?? null,
            company: seller.company ?? null,
            city: seller.city ?? null,
            province: seller.province ?? null,
            location: seller.location ?? null,
            avatar_url: seller.avatar_url ?? null,
            phone: seller.phone ?? null,
            created_at: seller.created_at ?? null,
            joined_at: seller.joined_at ?? null,
            plan_code: seller.plan_code ?? null,
            plan_label: seller.plan_label ?? (seller.plan_code || "Básico"),
            products_count: seller.products_count ?? 0,
            likes_count: seller.likes_count ?? 0,
          }} />}

          {/* CTA opcionales, como contactar al vendedor, pueden añadirse aquí en el futuro */}
        </div>
      </div>

      {/* Más del vendedor */}
      <SellerMoreProducts sellerId={product.user_id} excludeProductId={product.id} />

      {/* Productos similares */}
      <SimilarProducts category={product.category} excludeProductId={product.id} excludeSellerId={product.user_id} />

    </div>
  );
}

