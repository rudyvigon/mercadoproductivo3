"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Star, MapPin, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
  profiles?: {
    first_name?: string;
    last_name?: string;
    city?: string;
    province?: string;
  };
  primaryImageUrl?: string | null;
}

export default function FeaturedProductsCarousel() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);

  const supabase = createClient();

  // Responsive items per view
  useEffect(() => {
    const updateItemsPerView = () => {
      if (window.innerWidth < 640) setItemsPerView(1);
      else if (window.innerWidth < 768) setItemsPerView(2);
      else if (window.innerWidth < 1024) setItemsPerView(3);
      else setItemsPerView(4);
    };

    updateItemsPerView();
    window.addEventListener('resize', updateItemsPerView);
    return () => window.removeEventListener('resize', updateItemsPerView);
  }, []);

  // Cargar productos destacados
  useEffect(() => {
    async function fetchFeaturedProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .not('featured_until', 'is', null)
          .gte('featured_until', new Date().toISOString())
          .order('featured_until', { ascending: false })
          .limit(15);

        if (error) throw error;

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
              .select('first_name, last_name, city, province')
              .eq('id', product.user_id)
              .single();

            return {
              ...product,
              primaryImageUrl,
              profiles: profileData || {},
              location: profileData?.city && profileData?.province 
                ? `${profileData.city}, ${profileData.province}`
                : 'Ubicación no especificada'
            };
          })
        );

        setProducts(productsWithImages);
      } catch (error) {
        console.error('Error fetching featured products:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedProducts();
  }, [supabase]);

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + itemsPerView >= products.length ? 0 : prev + itemsPerView
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, products.length - itemsPerView) : Math.max(0, prev - itemsPerView)
    );
  };

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
    <section id="destacados" className="py-16 bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Productos Destacados
          </h2>
          <div className="w-24 h-1 bg-orange-500 mx-auto mb-6"></div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Descubre los mejores productos seleccionados especialmente para ti
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Navigation Buttons */}
          {products.length > itemsPerView && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors -ml-6"
                aria-label="Productos anteriores"
              >
                <ChevronLeft className="h-6 w-6 text-gray-600" />
              </button>
              
              <button
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors -mr-6"
                aria-label="Siguientes productos"
              >
                <ChevronRight className="h-6 w-6 text-gray-600" />
              </button>
            </>
          )}

          {/* Products Grid */}
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${(currentIndex * 100) / itemsPerView}%)`,
                width: `${(products.length * 100) / itemsPerView}%`
              }}
            >
              {products.map((product) => (
                <div 
                  key={product.id}
                  className="px-3"
                  style={{ width: `${100 / products.length}%` }}
                >
                  <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden">
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
                    
                    <CardContent className="p-4">
                      {/* Categoría */}
                      <Badge variant="secondary" className="mb-2 text-xs">
                        {product.category}
                      </Badge>
                      
                      {/* Título */}
                      <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                        {product.title}
                      </h3>
                      
                      {/* Ubicación */}
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{product.location}</span>
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
                      
                      {/* Botón */}
                      <Button asChild className="w-full bg-orange-500 hover:bg-orange-600">
                        <Link href={`/marketplace/product/${product.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Producto
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Indicators */}
        {products.length > itemsPerView && (
          <div className="flex justify-center mt-8 space-x-2">
            {Array.from({ 
              length: Math.ceil(products.length / itemsPerView) 
            }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index * itemsPerView)}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  Math.floor(currentIndex / itemsPerView) === index
                    ? "bg-orange-500 scale-125"
                    : "bg-gray-300 hover:bg-gray-400"
                )}
                aria-label={`Ir a la página ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
