import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProductForm from "@/components/products/product-form";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getNormalizedRoleFromUser } from "@/lib/auth/role";


export default async function NewProductPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Guard de rol: solo vendedores pueden crear productos
  const role = getNormalizedRoleFromUser(user);
  if (role !== "seller") {
    redirect("/profile");
  }

  // Calcular campos faltantes de perfil (incluye CP) para informar en el formulario
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

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4 sm:p-6 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">Nuevo producto</h1>
              <p className="text-sm text-muted-foreground">Completa los datos, adjunta imágenes y publica tu anuncio.</p>
            </div>
            <Link href="/dashboard/products" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowLeft size={16} /> Volver a mis productos
            </Link>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Datos del producto</CardTitle>
                <CardDescription>Ingresa información precisa para facilitar la compra</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductForm missingLabels={missingLabels} />
              </CardContent>
            </Card>
          </section>
    </div>
  );
}
