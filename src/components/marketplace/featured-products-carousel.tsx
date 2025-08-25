"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

interface FeaturedProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity_value: number;
  quantity_unit: string;
  category: string;
  location: string;
  user_id: string;
  primaryImageUrl?: string | null;
}

export default function FeaturedProductsCarousel() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar productos destacados
  useEffect(() => {
    async function fetchFeaturedProducts() {
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "30",
          onlyFeatured: "true",
          sortBy: "featured",
        });
        const res = await fetch(`/api/public/products?${params.toString()}`, { method: "GET", cache: "no-store" });
        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }
        const json = await res.json();
        const items: FeaturedProduct[] = Array.isArray(json?.items) ? json.items : [];
        setProducts(items);
      } catch (error) {
        console.error('Error fetching featured products:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedProducts();
  }, []);

  // Carrusel manual con flechas; sin autoplay

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <section className="py-16 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Productos Destacados
            </h2>
            <div className="w-24 h-1 bg-orange-500 mx-auto mb-6"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border animate-pulse">
                <div className="aspect-[4/3] bg-gray-200 rounded-t-lg"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="py-16 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Productos Destacados
          </h2>
          <div className="w-24 h-1 bg-orange-500 mx-auto mb-6"></div>
          <p className="text-gray-600">No hay productos destacados en este momento.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="destacados" className="pt-10 pb-20 bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Productos Destacados
          </h2>
          <div className="w-24 h-1 bg-orange-500 mx-auto" />
        </div>

        {/* Carrusel con flechas (sin autoplay) */}
        <div className="relative">
          <Carousel opts={{ align: "start", loop: false }}>
            <CarouselContent className="pb-4 sm:pb-6 md:pb-8">
              {products.map((product) => (
                <CarouselItem key={product.id} className="sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 pb-6 sm:pb-8 md:pb-10">
                  <div className="">
                    <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden h-full flex flex-col">
                      <div className="relative">
                        {/* Badge destacado */}
                        <Badge className="absolute top-3 left-3 z-10 bg-orange-500 hover:bg-orange-600">
                          <Star className="h-3 w-3 mr-1" />
                          Destacado
                        </Badge>
                        {/* Imagen */}
                        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                          {product.primaryImageUrl ? (
                            <Image
                              src={product.primaryImageUrl}
                              alt={product.title}
                              width={300}
                              height={200}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                              <div className="text-center text-orange-400">
                                <Star className="h-8 w-8 mx-auto mb-1" />
                                <span className="text-xs font-medium">Destacado</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-4 flex flex-col flex-1">
                        <Badge variant="secondary" className="mb-2 text-xs">
                          {product.category}
                        </Badge>
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                          {product.title}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 mb-3">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="truncate">{product.location || 'Ubicación no especificada'}</span>
                        </div>
                        <div className="mb-4">
                          <div>
                            <span className="text-2xl font-bold text-orange-600">{formatPrice(product.price)}</span>
                            <span className="text-sm text-gray-500 ml-1">/ {product.quantity_unit}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{product.quantity_value} {product.quantity_unit} disp.</div>
                        </div>
                        <div className="mt-auto flex gap-2">
                          <Button asChild className="flex-1 bg-orange-500 hover:bg-orange-600">
                            <Link href={`/products/${product.id}`}>
                              Ver Producto
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </div>
    </section>
  );
}
