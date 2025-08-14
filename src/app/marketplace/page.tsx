"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import BannerSlider from "@/components/marketplace/banner-slider";
import FeaturedProductsCarousel from "@/components/marketplace/featured-products-carousel";
import ProductFilters, { type ProductFilters as ProductFiltersType } from "@/components/marketplace/product-filters";
import ProductsGrid from "@/components/marketplace/products-grid";
import { Separator } from "@/components/ui/separator";
import { User } from "@supabase/supabase-js";

export default function MarketplacePage() {
  const [filters, setFilters] = useState<ProductFiltersType>({
    search: "",
    category: "all",
    minPrice: 0,
    maxPrice: 999999999,
    location: "all",
    sortBy: "newest",
    onlyFeatured: false
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 999999999 });
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isVendor, setIsVendor] = useState(false);

  const supabase = createClient();

  // Cargar usuario actual
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (user) {
          // Verificar si el usuario es vendedor usando metadatos
          const isVendor = 
            user.user_metadata?.role === 'anunciante' || 
            user.user_metadata?.user_type === 'seller';
          
          setIsVendor(isVendor);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    }
    
    loadUser();
  }, [supabase]);

  // Cargar datos iniciales para filtros
  useEffect(() => {
    async function loadFilterData() {
      try {
        setIsLoading(true);

        // Cargar categorías únicas
        const { data: categoryData } = await supabase
          .from('products')
          .select('category')
          .not('category', 'is', null);

        const uniqueCategories = Array.from(new Set(categoryData?.map(item => item.category) || []));
        setCategories(uniqueCategories.sort());

        // Cargar ubicaciones únicas (ciudad, provincia) - consulta simplificada
        const { data: locationData } = await supabase
          .from('profiles')
          .select('city, province')
          .not('city', 'is', null)
          .not('province', 'is', null);

        const uniqueLocations = Array.from(new Set(
          locationData
            ?.map(profile => 
              profile.city && profile.province 
                ? `${profile.city}, ${profile.province}`
                : null
            )
            .filter(Boolean) || []
        ));
        setLocations(uniqueLocations.sort());

        // Cargar rango de precios
        const { data: priceData } = await supabase
          .from('products')
          .select('price')
          .order('price', { ascending: true });

        if (priceData && priceData.length > 0) {
          const prices = priceData.map(item => item.price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          
          setPriceRange({ min: minPrice, max: maxPrice });
          setFilters(prev => ({
            ...prev,
            minPrice,
            maxPrice
          }));
        }

      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadFilterData();
  }, [supabase]);

  const handleFiltersChange = (newFilters: ProductFiltersType) => {
    setFilters(newFilters);
  };

  const handleProductsCountChange = (count: number) => {
    setTotalProducts(count);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Banner Principal */}
      <BannerSlider />

      {/* Productos Destacados */}
      <FeaturedProductsCarousel />

      {/* Separador */}
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Separator />
        </div>
      </div>

      {/* Sección Principal del Marketplace */}
      <section id="productos" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header de la sección */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Todos los Productos
            </h2>
            <div className="w-24 h-1 bg-orange-500 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explora nuestra amplia selección de productos agroindustriales de la mejor calidad
            </p>
          </div>

          {/* Filtros */}
          <div className="mb-8">
            <ProductFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              categories={categories}
              locations={locations}
              priceRange={priceRange}
              totalProducts={totalProducts}
              isLoading={isLoading}
            />
          </div>

          {/* Grid de Productos */}
          <ProductsGrid
            filters={filters}
            onProductsCountChange={handleProductsCountChange}
          />
        </div>
      </section>

      {/* Sección de llamada a la acción */}
      <section className="py-16 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Tienes productos para vender?
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Únete a nuestra comunidad de productores y llega a miles de compradores
          </p>
          
          {/* Verificar si el usuario es vendedor */}
          {user && isVendor ? (
            <div className="flex justify-center">
              <a
                href="/dashboard/products/new"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md bg-white text-orange-600 hover:bg-orange-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Publicar ahora
              </a>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/auth/register"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-orange-600 bg-white hover:bg-orange-50 transition-colors"
              >
                Crear cuenta gratis
              </a>
              <a
                href="/planes"
                className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-base font-medium rounded-md text-white hover:bg-white hover:text-orange-600 transition-colors"
              >
                Ver planes
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Footer informativo */}
      <section className="py-12 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Calidad Garantizada</h3>
              <p className="text-gray-600">
                Todos nuestros productos pasan por un proceso de verificación para asegurar la mejor calidad.
              </p>
            </div>
            
            <div>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Cobertura Nacional</h3>
              <p className="text-gray-600">
                Conectamos productores y compradores de todo el país para facilitar el comercio.
              </p>
            </div>
            
            <div>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Soporte 24/7</h3>
              <p className="text-gray-600">
                Nuestro equipo está disponible para ayudarte en cualquier momento que lo necesites.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
