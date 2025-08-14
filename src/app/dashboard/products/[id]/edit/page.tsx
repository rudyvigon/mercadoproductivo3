import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft, Package, AlertTriangle } from "lucide-react";
import ProductEditForm from "@/components/products/product-edit-form";

// Agregar configuración para forzar renderizado dinámico
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
  quantity_value: number;
  quantity_unit: string;
  featured_until?: string;
  created_at: string;
  user_id: string;
}

interface Profile {
  first_name?: string;
  last_name?: string;
  dni_cuit?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
}

export default async function EditProductPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // Validar parámetro ID
  if (!params?.id || typeof params.id !== 'string') {
    notFound();
  }

  const supabase = createClient();
  
  try {
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/auth/login");
    }

    // Obtener datos del producto para editar - doble intento: (id) y luego (id + user_id)
    let product: Product | null = null;
    let productError: any = null;

    {
      const { data, error } = await supabase
        .from('products')
        .select('id,title,description,price,category,location,quantity_value,quantity_unit,featured_until,created_at,user_id')
        .eq('id', params.id)
        .single();
      product = (data as any) as Product | null;
      productError = error;
    }

    if (!product) {
      const { data, error } = await supabase
        .from('products')
        .select('id,title,description,price,category,location,quantity_value,quantity_unit,featured_until,created_at,user_id')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();
      product = (data as any) as Product | null;
      if (!product) productError = error;
    }

    if (!product) {
      // Ayuda para depurar errores de RLS o de consulta
      // @ts-ignore
      const code = (productError as any)?.code;
      // @ts-ignore
      const details = (productError as any)?.details;
      // @ts-ignore
      const hint = (productError as any)?.hint;
      console.error('Error fetching dashboard product for edit (both attempts failed):', { code, details, hint, productError });
      notFound();
    }

    // Verificar que el producto pertenezca al usuario autenticado
    if (product.user_id !== user.id) {
      notFound();
    }

    // Verificar campos faltantes del perfil para mostrar advertencias
    let missingFields: string[] = [];
    
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name, dni_cuit, address, city, province, postal_code")
        .eq("id", user.id)
        .single();

      if (!profileError && profile) {
        const requiredFields = [
          { key: 'first_name', label: 'Nombre' },
          { key: 'last_name', label: 'Apellido' },
          { key: 'dni_cuit', label: 'DNI/CUIT' },
          { key: 'address', label: 'Dirección' },
          { key: 'city', label: 'Localidad' },
          { key: 'province', label: 'Provincia' },
          { key: 'postal_code', label: 'CP' }
        ];

        requiredFields.forEach(({ key, label }) => {
          const value = profile[key as keyof Profile];
          if (!value || String(value).trim().length === 0) {
            missingFields.push(label);
          }
        });
      }
    } catch (profileError) {
      console.error('Error checking profile:', profileError);
      // Si hay error al cargar perfil, asumir que faltan todos los campos
      missingFields = ['Nombre', 'Apellido', 'DNI/CUIT', 'Dirección', 'Localidad', 'Provincia', 'CP'];
    }

    return (
      <div className="mx-auto max-w-4xl p-4 space-y-4 sm:p-6 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold sm:text-2xl flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Editar producto
            </h1>
            <p className="text-sm text-muted-foreground">
              Modifica la información de tu producto &ldquo;{product.title}&rdquo;
            </p>
          </div>
          <Link 
            href="/dashboard/products" 
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={16} /> 
            Volver a mis productos
          </Link>
        </div>

        {/* Advertencia de perfil incompleto */}
        {missingFields.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-800 flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Perfil incompleto
              </CardTitle>
              <CardDescription className="text-amber-700">
                Para publicar productos necesitas completar: <strong>{missingFields.join(", ")}</strong>
                <br />
                <Link href="/dashboard/profile" className="text-amber-800 underline hover:no-underline">
                  Completar perfil ahora →
                </Link>
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Información del producto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información del producto</CardTitle>
            <CardDescription>
              Producto creado el {new Date(product.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductEditForm 
              product={product}
              canPublish={missingFields.length === 0}
            />
          </CardContent>
        </Card>
      </div>
    );

  } catch (error) {
    console.error('Error in EditProductPage:', error);
    notFound();
  }
}
