import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, Star, MapPin, Calendar, Package, 
  Phone, Mail, MessageCircle, Share2, Heart,
  User, Building, Clock, Eye, Shield, Crown
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductGallery } from "@/components/products/product-gallery";
import { RelatedProductsCarousel } from "@/components/marketplace/related-products-carousel";
import { createAdminClient } from "@/lib/supabase/admin";

interface ProductPageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProductPage({ params }: ProductPageProps) {
  const supabase = createClient();

  // Obtener producto por id (sin JOINs)
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !product) {
    notFound();
  }

  // Obtener perfil del vendedor a través del endpoint público
  let seller: any = null;
  try {
    const url = `/api/public/sellers/${product.user_id}`;
    const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      seller = json?.seller ?? null;
    } else {
      console.error('Sellers endpoint error', { status: res.status });
    }
  } catch (e) {
    // Silencio: si falla, mostramos placeholders en la UI
  }

  // Fallback: si el endpoint no devolvió datos, consultar directamente a Supabase
  if (!seller) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, company, city, province, avatar_url, updated_at, plan_activated_at, plan_code')
      .eq('id', product.user_id)
      .single();
    if (prof) {
      const first = (prof.first_name || '').trim();
      const last = (prof.last_name || '').trim();
      const full_name = (prof.full_name || `${first} ${last}`.trim()) || 'Vendedor';
      const location = prof.city && prof.province ? `${prof.city}, ${prof.province}` : null;
      const created_at = prof.updated_at ?? prof.plan_activated_at ?? null;
      seller = {
        id: prof.id,
        first_name: prof.first_name ?? null,
        last_name: prof.last_name ?? null,
        full_name,
        company: prof.company ?? null,
        city: prof.city ?? null,
        province: prof.province ?? null,
        location,
        avatar_url: prof.avatar_url ?? null,
        created_at,
        plan_code: prof.plan_code ?? null,
      };
    }
  }

  // Fallback final: usar Supabase Admin (requiere variables de entorno correctas)
  if (!seller) {
    try {
      const admin = createAdminClient();
      const { data: prof } = await admin
        .from('profiles')
        .select('id, first_name, last_name, full_name, company, city, province, avatar_url, updated_at, plan_activated_at, plan_code')
        .eq('id', product.user_id)
        .single();
      if (prof) {
        const first = (prof.first_name || '').trim();
        const last = (prof.last_name || '').trim();
        const full_name = (prof.full_name || `${first} ${last}`.trim()) || 'Vendedor';
        const location = prof.city && prof.province ? `${prof.city}, ${prof.province}` : null;
        const created_at = prof.updated_at ?? prof.plan_activated_at ?? null;
        seller = {
          id: prof.id,
          first_name: prof.first_name ?? null,
          last_name: prof.last_name ?? null,
          full_name,
          company: prof.company ?? null,
          city: prof.city ?? null,
          province: prof.province ?? null,
          location,
          avatar_url: prof.avatar_url ?? null,
          created_at,
          plan_code: prof.plan_code ?? null,
        };
      }
    } catch {}
  }

  // Obtener imágenes del producto
  const { data: images } = await supabase
    .from('product_images')
    .select('url')
    .eq('product_id', product.id)
    .order('id', { ascending: true });

  // Construir lista de URLs públicas solo desde product_images
  const imageUrls = (images || []).map((image: any) => image.url as string);

  // Obtener productos relacionados del mismo vendedor (con 1 imagen de portada)
  const { data: relatedProducts } = await supabase
    .from('products')
    .select(`
      id,
      title,
      price,
      quantity_unit,
      category,
      product_images ( url )
    `)
    .eq('user_id', product.user_id)
    .neq('id', product.id)
    .limit(5)
    .order('id', { ascending: true, foreignTable: 'product_images' })
    .limit(1, { foreignTable: 'product_images' });

  // Obtener productos similares (misma categoría) del mismo vendedor (máximo 2)
  const { data: similarProducts } = await supabase
    .from('products')
    .select(`
      id,
      title,
      price,
      quantity_unit,
      category
    `)
    .neq('user_id', product.user_id)
    .eq('category', product.category)
    .neq('id', product.id)
    .limit(2);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const isProductFeatured = () => {
    return product.featured_until && new Date(product.featured_until) > new Date();
  };

  const getSellerName = () => {
    if (seller?.company) return seller.company as string;
    if (seller?.full_name) return seller.full_name as string;
    if (seller?.first_name || seller?.last_name) {
      return `${seller?.first_name ?? ''} ${seller?.last_name ?? ''}`.trim() || 'Vendedor';
    }
    return 'Vendedor';
  };

  const getFullName = () => {
    const full = (seller?.full_name as string) || '';
    if (full) return full;
    const first = (seller?.first_name || '').trim();
    const last = (seller?.last_name || '').trim();
    const fallback = `${first} ${last}`.trim();
    return fallback || 'Vendedor';
  };

  const getLocation = () => {
    if (seller?.city && seller?.province) {
      return `${seller.city}, ${seller.province}`;
    }
    if (seller?.location) return seller.location as string;
    return 'Ubicación no especificada';
  };

  const getSellerSince = () => {
    if (seller?.created_at) {
      return formatDate(seller.created_at as string);
    }
    return 'Fecha no disponible';
  };

  const getPlanLabel = () => {
    if (seller?.plan_label) return String(seller.plan_label);
    const code = String((seller as any)?.plan_code || '').toLowerCase();
    if (code === 'free' || code === 'basic') return 'Básico';
    if (code === 'plus' || code === 'enterprise') return 'Plus';
    if (code === 'premium' || code === 'pro') return 'Premium';
    return 'Básico';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Link href="/marketplace" className="hover:text-orange-600 transition-colors">
              Marketplace
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate">{product.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Botón volver */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/marketplace">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al marketplace
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna principal - Producto */}
          <div className="lg:col-span-2 space-y-6">
            {/* Galería de imágenes */}
            <Card>
              <CardContent className="p-0">
                {imageUrls.length > 0 ? (
                  <ProductGallery images={imageUrls} title={product.title} />
                ) : (
                  <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center">
                    <Package className="h-16 w-16 text-gray-400" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Descripción */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {product.description}
                </p>
              </CardContent>
            </Card>

            {/* Más productos del vendedor - carrusel debajo de la imagen principal */}
            {relatedProducts && relatedProducts.length > 0 && (
              <RelatedProductsCarousel items={relatedProducts as any} />
            )}
          </div>

          {/* Sidebar - Información del vendedor */}
          <div className="space-y-6 flex flex-col h-full">
            {/* Perfil del vendedor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Información del Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={seller?.avatar_url} />
                    <AvatarFallback>
                      {(seller?.company?.charAt(0)?.toUpperCase()) || 'V'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold">{seller?.company || 'Vendedor'}</h4>
                    <p className="text-sm text-gray-500">
                      Miembro desde {getSellerSince()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                    <span>Plan: <span className="font-medium">{getPlanLabel()}</span></span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{getLocation()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta principal del producto (movida al sidebar) */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{product.category}</Badge>
                      {isProductFeatured() && (
                        <Badge className="bg-orange-500">
                          <Star className="h-3 w-3 mr-1" />
                          Destacado
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-2 break-words">{product.title}</CardTitle>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm">
                      <Heart className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-orange-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-3xl md:text-4xl font-bold text-orange-600">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-lg text-gray-600 ml-2">
                        / {product.quantity_unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Disponible</div>
                      <div className="text-xl font-semibold text-green-600">
                        {product.quantity_value} {product.quantity_unit}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button className="w-full bg-orange-500 hover:bg-orange-600 justify-center">
                      <Phone className="h-4 w-4 mr-2" />
                      Contactar Vendedor
                    </Button>
                    <Button variant="outline" className="w-full justify-center">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar Mensaje
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compra Segura queda inmediatamente debajo de la tarjeta principal */}

            {/* Productos similares del vendedor (debajo de Compra Segura) */}
            {similarProducts && similarProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Otros vendedores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {similarProducts.map((sp) => (
                    <Link
                      key={sp.id}
                      href={`/marketplace/product/${sp.id}`}
                      className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <h5 className="font-medium text-sm line-clamp-2 mb-1">{sp.title}</h5>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">{sp.category}</Badge>
                        <span className="text-sm font-semibold text-orange-600">{formatPrice(sp.price)}</span>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Garantías y seguridad */}
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Compra Segura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Vendedor Verificado</p>
                    <p className="text-xs text-gray-500">
                      Perfil validado por nuestro equipo
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Soporte 24/7</p>
                    <p className="text-xs text-gray-500">
                      Asistencia completa durante tu compra
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Calidad Garantizada</p>
                    <p className="text-xs text-gray-500">
                      Productos verificados y de calidad
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
