import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ProductGallery } from "@/components/products/product-gallery";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id,user_id,title,description,category,price,quantity_value,quantity_unit,images,created_at"
    )
    .eq("id", params.id)
    .single();

  if (error || !product) notFound();
  if (product.user_id !== user.id) notFound();

  // Construir lista de imágenes desde products.images y, si existe, desde product_images
  let imageUrls: string[] = [];
  try {
    if (Array.isArray(product.images)) {
      imageUrls = product.images.filter(Boolean);
    } else if (typeof product.images === "string" && product.images) {
      imageUrls = [product.images];
    }
  } catch {}

  try {
    const { data: extraImages, error: extraErr } = await supabase
      .from("product_images")
      .select("url")
      .eq("product_id", product.id);
    if (!extraErr && extraImages && extraImages.length > 0) {
      const urls = extraImages.map((r: { url: string }) => r.url).filter(Boolean);
      const set = new Set([...(imageUrls || []), ...urls]);
      imageUrls = Array.from(set);
    }
  } catch {}

  const mainImage = imageUrls[0] ?? null;
  const priceFmt = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(product.price));
  const quantity = `${Number(product.quantity_value)} ${product.quantity_unit}`;

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4 sm:p-6 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Button variant="outline" asChild size="sm">
              <Link href="/dashboard/products">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-orange-500 text-white hover:bg-orange-600">
              <Link href={`/dashboard/products/${product.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <ProductGallery images={imageUrls} title={product.title} />
            </div>

            <div className="space-y-4">
              <h1 className="text-xl font-semibold sm:text-2xl">{product.title}</h1>
              <div className="text-base sm:text-lg">
                <span className="font-medium">{priceFmt}</span>
                <span className="text-muted-foreground">{" · "}{quantity}</span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground sm:text-sm">Categoría</div>
                <div className="text-sm">{product.category}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground sm:text-sm">Descripción</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {product.description}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Publicado: {new Date(product.created_at).toLocaleDateString("es-AR")}
              </div>
            </div>
          </div>
    </div>
  );
}
