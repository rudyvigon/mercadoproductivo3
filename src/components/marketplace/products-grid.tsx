"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Star, MapPin, Eye, Heart, Share2, 
  Package, Clock, User, Phone 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProductFilters } from "./product-filters";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity_value: number;
  quantity_unit: string;
  category: string;
  created_at: string;
  featured_until?: string;
  user_id: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    city?: string;
    province?: string;
    company?: string;
  };
  primaryImageUrl?: string | null;
}

interface ProductsGridProps {
  filters: ProductFilters;
  onProductsCountChange: (count: number) => void;
}

export default function ProductsGrid({ filters, onProductsCountChange }: ProductsGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const supabase = createClient();
  const PRODUCTS_PER_PAGE = 12;

  // Cargar productos
  useEffect(() => {
    loadProducts(true);
  }, [filters]);

  const loadProducts = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      console.log('Loading products with filters:', filters);

      const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
      const to = from + PRODUCTS_PER_PAGE - 1;

      let query = supabase
        .from('products')
        .select('*')
        .range(from, to);

      // Aplicar filtros
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
      }

      if (filters.category && filters.category !== "all") {
        query = query.eq('category', filters.category);
      }

      if (filters.minPrice > 0 || filters.maxPrice < 999999999) {
        query = query.gte('price', filters.minPrice).lte('price', filters.maxPrice);
      }

      // Nota: El filtro de ubicación requiere una consulta más compleja con joins
      // Por ahora lo omitimos para evitar errores, se puede implementar más adelante

      if (filters.onlyFeatured) {
        query = query.not('featured_until', 'is', null)
                    .gte('featured_until', new Date().toISOString());
      }

      // Aplicar ordenamiento
      switch (filters.sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          break;
        case 'featured':
          query = query.order('featured_until', { ascending: false, nullsFirst: false })
                      .order('created_at', { ascending: false });
          break;
        case 'alphabetical':
          query = query.order('title', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      // Obtener datos del vendedor e imagen principal para cada producto
      const productsWithImages = await Promise.all(
        (data || []).map(async (product) => {
          // Buscar primera imagen en product_images
          let primaryImageUrl: string | null = null;
          try {
            const { data: imgRows } = await supabase
              .from('product_images')
              .select('url')
              .eq('product_id', product.id)
              .order('id', { ascending: true })
              .limit(1);
            primaryImageUrl = imgRows && imgRows.length > 0 ? (imgRows[0] as any).url : null;
          } catch {}

          // Obtener datos del vendedor por separado
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, city, province, company')
            .eq('id', product.user_id)
            .single();

          return {
            ...product,
            primaryImageUrl,
            profiles: profileData || {}
          };
        })
      );

      if (reset) {
        setProducts(productsWithImages);
      } else {
        setProducts(prev => [...prev, ...productsWithImages]);
      }

      setHasMore(productsWithImages.length === PRODUCTS_PER_PAGE);
      
      // Obtener conteo total para filtros
      if (reset) {
        const { count: totalCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });
        
        onProductsCountChange(totalCount || 0);
      }

    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setPage(prev => prev + 1);
      loadProducts(false);
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

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
      month: 'short',
      year: 'numeric'
    });
  };

  const isProductFeatured = (product: Product) => {
    return product.featured_until && new Date(product.featured_until) > new Date();
  };

  const getSellerName = (product: Product) => {
    const profile = product.profiles;
    if (profile?.company) return profile.company;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return 'Vendedor';
  };

  const getLocation = (product: Product) => {
    const profile = product.profiles;
    if (profile?.city && profile?.province) {
      return `${profile.city}, ${profile.province}`;
    }
    return 'Ubicación no especificada';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full" />
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No se encontraron productos
        </h3>
        <p className="text-gray-600 mb-6">
          Intenta ajustar los filtros para encontrar lo que buscas
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Recargar página
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Grid de productos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden">
            <div className="relative">
              {/* Badges */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                {isProductFeatured(product) && (
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    <Star className="h-3 w-3 mr-1" />
                    Destacado
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {product.category}
                </Badge>
              </div>

              {/* Botones de acción */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                  onClick={() => toggleFavorite(product.id)}
                >
                  <Heart 
                    className={cn(
                      "h-4 w-4",
                      favorites.has(product.id) ? "fill-red-500 text-red-500" : "text-gray-600"
                    )} 
                  />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                  onClick={() => navigator.share?.({ 
                    title: product.title, 
                    url: window.location.origin + `/marketplace/product/${product.id}` 
                  })}
                >
                  <Share2 className="h-4 w-4 text-gray-600" />
                </Button>
              </div>

              {/* Imagen */}
              <div className="aspect-[4/3] overflow-hidden bg-gray-100 flex items-center justify-center">
                {product.primaryImageUrl ? (
                  <Image
                    src={product.primaryImageUrl}
                    alt={product.title}
                    width={400}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Package className="h-12 w-12 mx-auto mb-2" />
                      <span className="text-sm">Sin imagen</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <CardContent className="p-4">
              {/* Título */}
              <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                {product.title}
              </h3>
              
              {/* Descripción */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {product.description}
              </p>
              
              {/* Vendedor y ubicación */}
              <div className="space-y-1 mb-3">
                <div className="flex items-center text-sm text-gray-500">
                  <User className="h-4 w-4 mr-1" />
                  <span className="truncate">{getSellerName(product)}</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span className="truncate">{getLocation(product)}</span>
                </div>
              </div>
              
              {/* Precio y cantidad */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-2xl font-bold text-orange-600">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    / {product.quantity_unit}
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {product.quantity_value} {product.quantity_unit} disp.
                </span>
              </div>
              
              {/* Fecha de publicación */}
              <div className="flex items-center text-xs text-gray-400 mb-4">
                <Clock className="h-3 w-3 mr-1" />
                Publicado {formatDate(product.created_at)}
              </div>
              
              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button asChild className="flex-1 bg-orange-500 hover:bg-orange-600">
                  <Link href={`/marketplace/product/${product.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Producto
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="px-3">
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Botón cargar más */}
      {hasMore && (
        <div className="text-center">
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            variant="outline"
            size="lg"
            className="px-8"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
                Cargando...
              </>
            ) : (
              'Cargar más productos'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
