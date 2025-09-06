"use client";

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Star, MapPin, Heart, Share2, 
  Package, Clock, User, Phone,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductFilters } from "./product-filters";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";

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
  location?: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    city?: string;
    province?: string;
    company?: string;
    plan_code?: string;
  };
  primaryImageUrl?: string | null;
}

interface ProductsGridProps {
  filters: ProductFilters;
  onProductsCountChange: (count: number) => void;
  sellerId?: string;
  excludeProductId?: string;
  excludeSellerId?: string;
  variant?: "default" | "comfortable" | "compact";
  pageSize?: number;
  showPagination?: boolean;
}

export default function ProductsGrid({ filters, onProductsCountChange, sellerId, excludeProductId, excludeSellerId, variant = "default", pageSize, showPagination = true }: ProductsGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const DEFAULT_PAGE_SIZE = 12;
  const PAGE_SIZE = pageSize ?? DEFAULT_PAGE_SIZE;

  // Caché simple en memoria por número de página para transiciones instantáneas
  const pageCacheRef = useRef<Record<number, Product[]>>({});

  // Ref al inicio de la sección para desplazar la vista al paginar
  const sectionTopRef = useRef<HTMLDivElement | null>(null);

  // (se mueve más abajo, después de declarar loadProducts)

  const loadProducts = useCallback(async (
    { reset = false, page, pageSize }: { reset?: boolean; page: number; pageSize: number }
  ) => {
    try {
      const currentPage = page;

      if (reset) {
        // Si hay caché, mostrarla al instante y evitar el flicker de loading
        const cached = pageCacheRef.current[currentPage];
        if (!cached) {
          setLoading(true);
        } else {
          setProducts(cached);
          setLoading(false);
        }
        // Si se está navegando a una página específica, no forzar page=1
        if (currentPage === 1) {
          setPage(1);
        }
      } else {
        setLoadingMore(true);
      }
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      params.set('minPrice', String(filters.minPrice ?? 0));
      params.set('maxPrice', String(filters.maxPrice ?? 999999999));
      if (filters.location) params.set('location', filters.location);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      params.set('onlyFeatured', String(!!filters.onlyFeatured));
      if (sellerId) params.set('sellerId', sellerId);
      if (excludeProductId) params.set('excludeProductId', excludeProductId);
      if (excludeSellerId) params.set('excludeSellerId', excludeSellerId);

      const res = await fetch(`/api/public/products?${params.toString()}`, {
        method: 'GET',
      });
      if (!res.ok) {
        throw new Error(`Error de API (${res.status})`);
      }
      const json = await res.json();
      const items: Product[] = json.items || [];
      const total: number = json.total ?? 0;
      const apiHasMore: boolean = json.hasMore ?? false;

      if (reset) {
        setProducts(items);
      } else {
        setProducts(prev => [...prev, ...items]);
      }

      // Guardar en caché esta página
      pageCacheRef.current[currentPage] = items;

      setHasMore(apiHasMore);

      if (reset) {
        setTotal(total);
        onProductsCountChange(total);
      }

      // Prefetch de páginas adyacentes para navegación instantánea
      const prefetch = async (targetPage: number) => {
        if (targetPage < 1) return;
        if (pageCacheRef.current[targetPage]) return;
        const preParams = new URLSearchParams(params);
        preParams.set('page', String(targetPage));
        try {
          const r = await fetch(`/api/public/products?${preParams.toString()}`, { method: 'GET' });
          if (!r.ok) return;
          const j = await r.json();
          const it: Product[] = j.items || [];
          pageCacheRef.current[targetPage] = it;
        } catch {}
      };

      if (apiHasMore) {
        void prefetch(currentPage + 1);
      }
      if (currentPage > 1) {
        void prefetch(currentPage - 1);
      }

    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, onProductsCountChange, sellerId, excludeProductId, excludeSellerId]);

  // Cargar productos al cambiar filtros (reset)
  useEffect(() => {
    // Limpiar caché al cambiar filtros para no mezclar resultados
    pageCacheRef.current = {};
    loadProducts({ reset: true, page: 1, pageSize: PAGE_SIZE });
  }, [filters, loadProducts, PAGE_SIZE]);

  // Navegación de paginación numérica
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goToPage = (n: number) => {
    if (n < 1 || n > totalPages || n === page) return;
    setPage(n);
    // Mostrar de inmediato si está en caché y revalidar en background
    const cached = pageCacheRef.current[n];
    if (cached) {
      setProducts(cached);
      setLoading(false);
    }
    // Desplazar suavemente al inicio de la sección (compensa navbar fija)
    if (typeof window !== 'undefined') {
      const el = sectionTopRef.current;
      if (el) {
        const headerOffset = 90; // ajustar si cambia la altura del header fijo
        const y = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }
    loadProducts({ reset: true, page: n, pageSize: PAGE_SIZE });
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
    const code = String(profile?.plan_code || '').toLowerCase();
    const isBasic = ["gratis", "free", "basic"].includes(code);
    if (isBasic) return "Usuario Básico";
    if (profile?.company) return profile.company;
    return 'Vendedor';
  };

  const getLocation = (product: Product) => {
    return product.location || 'Ubicación no especificada';
  };

  if (loading) {
    return (
      <div className={cn(
        variant === "compact"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
          : variant === "comfortable"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        "items-stretch"
      )}>
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <Card key={i} className="overflow-hidden h-full">
            <Skeleton className={cn("w-full",
              variant === "compact" ? "aspect-square" : "aspect-[4/3]"
            )} />
            <CardContent className={cn("space-y-3",
              variant === "compact" ? "p-3" : variant === "comfortable" ? "p-3" : "p-4"
            ) }>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              {variant !== "compact" && <Skeleton className="h-6 w-1/3" />}
              <Skeleton className={cn(
                variant === "compact" ? "h-8" : variant === "comfortable" ? "h-9" : "h-10",
                "w-full"
              )} />
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
    <div ref={sectionTopRef} className="space-y-8">
      {/* Grid de productos */}
      <div className={cn(
        variant === "compact"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
          : variant === "comfortable"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        "items-stretch"
      )}>
        {products.map((product) => (
          <Card key={product.id} className={cn("group hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden h-full flex flex-col", variant === "compact" && "text-sm")}>
            <div className="relative">
              {/* Badges */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                {variant !== "compact" && isProductFeatured(product) && (
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    <Star className="h-3 w-3 mr-1" />
                    Destacado
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {product.category}
                </Badge>
              </div>

              {/* Botones de acción */}
              {variant !== "compact" && (
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
                    url: window.location.origin + `/products/${product.id}` 
                  })}
                >
                  <Share2 className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
              )}

              {/* Imagen */}
              <div className={cn("overflow-hidden bg-gray-100 flex items-center justify-center",
                variant === "compact" ? "aspect-square" : "aspect-[4/3]"
              ) }>
                {product.primaryImageUrl ? (
                  <Image
                    src={product.primaryImageUrl}
                    alt={product.title}
                    width={400}
                    height={400}
                    className={cn("w-full h-full object-cover group-hover:scale-105 transition-transform duration-300")}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Package className={cn("mx-auto mb-2",
                        variant === "compact" ? "h-8 w-8" : variant === "comfortable" ? "h-10 w-10" : "h-12 w-12"
                      )} />
                      <span className={cn(
                        variant === "compact" ? "text-xs" : variant === "comfortable" ? "text-sm" : "text-sm"
                      )}>Sin imagen</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <CardContent className={cn(
              variant === "compact" ? "p-3" : variant === "comfortable" ? "p-3" : "p-4",
              "flex flex-col flex-1"
            ) }>
              {/* Título */}
              <h3 className={cn("font-semibold mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors",
                variant === "compact" ? "text-base" : variant === "comfortable" ? "text-base" : "text-lg"
              ) }>
                {product.title}
              </h3>
              
              {/* Vendedor y ubicación */}
              <div className={cn("space-y-1",
                variant === "compact" ? "mb-2" : variant === "comfortable" ? "mb-2" : "mb-3"
              ) }>
                <div className={cn("flex items-center text-gray-500",
                  variant === "compact" ? "text-xs" : variant === "comfortable" ? "text-sm" : "text-sm"
                ) }>
                  <User className="h-4 w-4 mr-1" />
                  <span className="truncate" data-testid={`product-card-seller-${product.id}`}>{getSellerName(product)}</span>
                </div>
                <div className={cn("flex items-center text-gray-500",
                  variant === "compact" ? "text-xs" : variant === "comfortable" ? "text-sm" : "text-sm"
                ) }>
                  <MapPin className="h-4 w-4 mr-1" />
                  <span className="truncate">{getLocation(product)}</span>
                </div>
              </div>
              
              {/* Precio y cantidad */}
              <div className={cn(
                variant === "compact" ? "mb-3" : variant === "comfortable" ? "mb-3" : "mb-4"
              ) }>
                <div>
                  <span className={cn("font-bold text-orange-600",
                    variant === "compact" ? "text-xl" : variant === "comfortable" ? "text-xl" : "text-2xl"
                  ) }>
                    {formatPrice(product.price)}
                  </span>
                  <span className={cn("text-gray-500 ml-1",
                    variant === "compact" ? "text-xs" : variant === "comfortable" ? "text-sm" : "text-sm"
                  ) }>
                    / {product.quantity_unit}
                  </span>
                </div>
                {variant !== "compact" && (
                  <div className="text-sm text-gray-600 mt-1">
                    {product.quantity_value} {product.quantity_unit} disp.
                  </div>
                )}
              </div>
              
              {/* Fecha de publicación */}
              {variant !== "compact" && (
                <div className="flex items-center text-xs text-gray-400 mb-4">
                  <Clock className="h-3 w-3 mr-1" />
                  Publicado {formatDate(product.created_at)}
                </div>
              )}
              
              {/* Botones de acción */}
              <div className="mt-auto flex gap-2">
                <Button asChild className="flex-1 bg-orange-500 hover:bg-orange-600" size={variant === "compact" ? "sm" : variant === "comfortable" ? "default" : undefined}>
                  <Link href={`/products/${product.id}`}>
                    Ver Producto
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginación (shadcn) */}
      {showPagination && totalPages >= 1 && (
        <Pagination className="mt-4">
          <PaginationContent className="bg-white border rounded-full p-1 shadow-sm">
            <PaginationItem>
              <PaginationLink
                href="#"
                className={cn(page === 1 ? "pointer-events-none opacity-50" : "gap-1 pl-2.5 pr-3 rounded-full")}
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(page - 1);
                }}
                size="default"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </PaginationLink>
            </PaginationItem>

            {/* Números con elipsis */}
            {(() => {
              const items: React.ReactNode[] = [];
              const pushPage = (p: number) =>
                items.push(
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      size="icon"
                      className={p === page ? "bg-orange-500 text-white hover:bg-orange-600 border-orange-500" : ""}
                      onClick={(e) => {
                        e.preventDefault();
                        goToPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );

              // Siempre mostrar página 1
              pushPage(1);

              // Elipsis después de 1
              const start = Math.max(2, page - 1);
              const end = Math.min(totalPages - 1, page + 1);
              if (start > 2) {
                items.push(
                  <PaginationItem key="start-ellipsis">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              // Ventana alrededor de la actual
              for (let p = start; p <= end; p++) {
                pushPage(p);
              }

              // Elipsis antes del final
              if (end < totalPages - 1) {
                items.push(
                  <PaginationItem key="end-ellipsis">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              // Última página si es mayor a 1
              if (totalPages > 1) {
                pushPage(totalPages);
              }

              return items;
            })()}

            <PaginationItem>
              <PaginationLink
                href="#"
                className={cn(page === totalPages ? "pointer-events-none opacity-50" : "gap-1 pr-2.5 pl-3 rounded-full")}
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(page + 1);
                }}
                size="default"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
