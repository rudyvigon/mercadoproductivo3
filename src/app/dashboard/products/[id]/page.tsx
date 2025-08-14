import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ProductGallery } from "@/components/products/product-gallery";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Star, MapPin } from "lucide-react";


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

  // Estrategia de doble intento: primero por id, luego por (id + user_id) si no hay resultado
  let product: any = null;
  let error: any = null;

  {
    const { data, error: err } = await supabase
      .from("products")
      .select(
        "id,user_id,title,description,category,price,quantity_value,quantity_unit,created_at,location,featured_until"
      )
      .eq("id", params.id)
      .single();
    product = data;
    error = err;
  }

  if (!product) {
    const { data, error: err } = await supabase
      .from("products")
      .select(
        "id,user_id,title,description,category,price,quantity_value,quantity_unit,created_at,location,featured_until"
      )
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();
    product = data;
    // solo guardamos error si sigue sin producto
    if (!product) error = err;
  }

  if (!product) {
    // Ayuda para depurar errores de RLS o de consulta
    // @ts-ignore
    const code = (error as any)?.code;
    // @ts-ignore
    const details = (error as any)?.details;
    // @ts-ignore
    const hint = (error as any)?.hint;
    console.error("Error fetching dashboard product detail (both attempts failed):", { code, details, hint, error });
    notFound();
  }
  if (product.user_id !== user.id) notFound();

  // Cargar imágenes desde product_images
  const { data: imagesData } = await supabase
    .from("product_images")
    .select("url")
    .eq("product_id", product.id)
    .order("id", { ascending: true });
  const imageUrls: string[] = (imagesData || []).map((i: any) => i.url);
  const priceFmt = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(product.price));
  const quantity = `${Number(product.quantity_value)} ${product.quantity_unit}`;
  const isFeatured = Boolean(
    product.featured_until && new Date(product.featured_until) > new Date()
  );

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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl">{product.title}</h1>
                {isFeatured && (
                  <Badge className="bg-orange-500 text-white">
                    <Star className="mr-1 h-3 w-3" /> Destacado
                  </Badge>
                )}
              </div>
              <div className="text-base sm:text-lg">
                <span className="font-medium">{priceFmt}</span>
                <span className="text-muted-foreground">{" · "}{quantity}</span>
              </div>
              <div className="text-sm text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {product.location}
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
