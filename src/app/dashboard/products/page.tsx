import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { GuardedCreateButton } from "@/components/dashboard/guarded-create-button";
import { Button } from "@/components/ui/button";
import FeatureProductButton from "@/components/products/feature-product-button";


export const dynamic = "force-dynamic";

export default async function ProductsDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Campos faltantes del perfil para bloquear creación si no está completo
  let missingLabels: string[] = [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name,last_name,dni_cuit,address,city,province,postal_code")
      .eq("id", user.id)
      .single();
    if (!error) {
      const requiredMap: Record<string, string> = {
        first_name: "Nombre",
        last_name: "Apellido",
        dni_cuit: "DNI/CUIT",
        address: "Dirección",
        city: "Localidad",
        province: "Provincia",
        postal_code: "CP",
      };
      Object.entries(requiredMap).forEach(([key, label]) => {
        // @ts-ignore
        if (!data?.[key] || String(data?.[key]).trim().length === 0) missingLabels.push(label);
      });
    }
  } catch {}

  // Traer productos del usuario autenticado
  const {
    data: products,
    error: productsError,
  } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Ordenar en memoria: destacados vigentes primero, luego por fecha de creación desc
  const nowDate = new Date();
  const sortedProducts = (products ?? []).slice().sort((a: any, b: any) => {
    const aFeat = a?.featured_until && new Date(a.featured_until) > nowDate ? 1 : 0;
    const bFeat = b?.featured_until && new Date(b.featured_until) > nowDate ? 1 : 0;
    if (aFeat !== bFeat) return bFeat - aFeat; // primero destacados
    const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <div className="w-full p-4 space-y-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <h1 className="text-xl font-semibold sm:text-2xl">Mis anuncios</h1>
        <GuardedCreateButton
          href="/dashboard/products/new"
          missingLabels={missingLabels}
          className="relative overflow-hidden group inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 sm:w-auto"
        >
          <span className="pointer-events-none absolute -left-20 top-0 h-full w-1/3 -skew-x-12 bg-white/30 transition-transform duration-500 group-hover:translate-x-[200%]" />
          <PackagePlus size={16} />
          <span>Nuevo Producto</span>
        </GuardedCreateButton>
      </div>
          {productsError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
          <div>No se pudieron cargar tus anuncios: {productsError.message}</div>
          {(() => {
            // @ts-ignore
            const code = (productsError as any)?.code;
            // @ts-ignore
            const details = (productsError as any)?.details;
            // @ts-ignore
            const hint = (productsError as any)?.hint;
            if (code || details || hint) {
              return (
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify({ code, details, hint }, null, 2)}
                </pre>
              );
            }
            return null;
          })()}
        </div>
      )}

      <div className="text-xs text-muted-foreground">{`Mostrando ${products?.length ?? 0} producto(s)`}</div>

      {(products?.length ?? 0) === 0 ? (
        <div className="rounded border p-4 text-sm text-muted-foreground bg-muted/10">
          No hay anuncios todavía.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sortedProducts.map((p: any) => (
            <div key={p.id} className="overflow-hidden rounded border bg-background">
              <div className="relative h-32 w-full sm:h-40">
                {(() => {
                  const firstImage = Array.isArray(p.images) ? p.images[0] : p.images;
                  return firstImage ? (
                    <Image
                      src={firstImage as string}
                      alt={p.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  );
                })()}
                {p?.featured_until && new Date(p.featured_until) > new Date() && (
                  <div className="absolute left-2 top-2 rounded bg-orange-500 px-2 py-0.5 text-[10px] font-medium text-white shadow">
                    Destacado
                  </div>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <div className="line-clamp-2 text-sm font-medium sm:text-base mb-2">{p.title}</div>
                <div className="text-xs text-muted-foreground sm:text-sm mb-3">
                  {Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(p.price))}
                  {" · "}
                  {Number(p.quantity_value)} {p.quantity_unit}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1 min-w-[80px] bg-white text-[#f06d04] border border-[#f06d04] hover:bg-[#f06d04]/10">
                    <Link href={`/dashboard/products/${p.id}`}>Ver detalles</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1 min-w-[60px] bg-orange-500 text-white hover:bg-orange-600">
                    <Link href={`/dashboard/products/${p.id}/edit`}>Editar</Link>
                  </Button>
                  <div className="w-full mt-1">
                    <FeatureProductButton productId={p.id} featuredUntil={p.featured_until} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
