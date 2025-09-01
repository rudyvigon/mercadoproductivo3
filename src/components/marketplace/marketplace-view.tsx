"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import BannerSlider from "@/components/marketplace/banner-slider";
import FeaturedProductsCarousel from "@/components/marketplace/featured-products-carousel";
import ProductFilters, { type ProductFilters as ProductFiltersType } from "@/components/marketplace/product-filters";
import ProductsGrid from "@/components/marketplace/products-grid";
import { Separator } from "@/components/ui/separator";
import { User } from "@supabase/supabase-js";

export default function MarketplaceView() {
  const [filters, setFilters] = useState<ProductFiltersType>({
    search: "",
    category: "all",
    minPrice: 0,
    maxPrice: 999999999,
    location: "all",
    sortBy: "newest",
    onlyFeatured: false,
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 999999999 });
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const supabase = createClient();

  // Cargar usuario actual
  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          // Normalizar rol (compat: usar user_type legacy si existe) y evaluar solo contra 'seller'
          const roleRaw = (user.user_metadata?.role || user.user_metadata?.user_type || "").toString();
          const roleNormalized = roleRaw === "anunciante" ? "seller" : roleRaw;
          setIsVendor(roleNormalized === "seller");
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    }

    loadUser();
  }, [supabase]);

  // Detectar mobile para ajustar pageSize de ProductsGrid
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    } else {
      // @ts-ignore
      mq.addListener(update);
      return () => {
        // @ts-ignore
        mq.removeListener(update);
      };
    }
  }, []);

  // Cargar datos iniciales para filtros
  useEffect(() => {
    async function loadFilterData() {
      try {
        setIsLoading(true);

        // Cargar categorías desde tabla `categories` con fallback a `products.category`
        let resolvedCategories: string[] = [];
        try {
          const { data: catData, error: catError } = await supabase
            .from("categories")
            .select("*");
          if (!catError && Array.isArray(catData)) {
            resolvedCategories = Array.from(
              new Set(
                (catData as any[])
                  .map((r) => (r?.name ?? r?.title ?? r?.label ?? r?.slug ?? "").toString().replace(/[-_]/g, " ").trim())
                  .filter(Boolean)
              )
            ).sort((a, b) => a.localeCompare(b));
          }
        } catch {
          // Ignoramos y caemos al fallback
        }
        if (!resolvedCategories.length) {
          const { data: categoryData } = await supabase
            .from("products")
            .select("category")
            .eq("published", true)
            .not("category", "is", null);
          resolvedCategories = Array.from(
            new Set((categoryData?.map((item) => (item as any)?.category?.toString().trim()) || []).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));
        }
        setCategories(resolvedCategories);

        // Cargar ubicaciones únicas desde products.location
        const { data: locationData } = await supabase
          .from("products")
          .select("location")
          .eq("published", true)
          .not("location", "is", null);

        const uniqueLocations = Array.from(
          new Set(
            (locationData?.map((item: { location: string | null }) => item.location) || [])
              .filter((loc): loc is string => Boolean(loc))
          )
        );
        setLocations(uniqueLocations.sort());

        // Cargar rango de precios
        const { data: priceData } = await supabase
          .from("products")
          .select("price")
          .eq("published", true)
          .order("price", { ascending: true });

        if (priceData && priceData.length > 0) {
          const prices = priceData.map((item) => item.price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);

          setPriceRange({ min: minPrice, max: maxPrice });
          setFilters((prev) => ({
            ...prev,
            minPrice,
            maxPrice,
          }));
        }
      } catch (error) {
        console.error("Error loading filter data:", error);
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
            variant="comfortable"
            pageSize={isMobile ? 10 : 20}
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
            Únete a nuestra comunidad de vendedores y llega a miles de compradores
          </p>

          {/* Verificar si el usuario es vendedor */}
          {user && isVendor ? (
            <div className="flex justify-center">
              <a
                href="/dashboard/products/new"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md bg-white text-orange-600 hover:bg-orange-50 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
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
    </div>
  );
}
