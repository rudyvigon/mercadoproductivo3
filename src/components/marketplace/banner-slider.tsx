"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const bannerSlides = [
  {
    id: 1,
    title: "Conectamos Productores y Compradores",
    subtitle: "La plataforma líder del sector agroindustrial",
    description: "Descubre productos frescos directamente del campo a tu mesa",
    cta: "Explorar Productos",
    ctaLink: "#productos"
  },
  {
    id: 2,
    title: "Productos Destacados del Mes",
    subtitle: "Calidad garantizada",
    description: "Los mejores productos seleccionados por nuestros expertos",
    cta: "Ver Destacados",
    ctaLink: "#destacados"
  },
  {
    id: 3,
    title: "Únete a Nuestra Comunidad",
    subtitle: "Más de 1000 productores confían en nosotros",
    description: "Forma parte del marketplace agroindustrial más grande",
    cta: "Registrarse",
    ctaLink: "/auth/register"
  }
];

export default function BannerSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [slideImages, setSlideImages] = useState<(string | null)[]>([null, null, null]);

  // Detectar sesión para ocultar botón de registro si el usuario está logueado
  useEffect(() => {
    const supabase = createClient();
    let unsub: { unsubscribe: () => void } | null = null;
    supabase.auth.getSession().then(({ data }) => setIsLoggedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    unsub = data.subscription;
    return () => {
      unsub?.unsubscribe();
    };
  }, []);

  // Cargar imágenes del endpoint público que entrega URLs firmadas
  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: String(bannerSlides.length), folder: "imagessite" });
        const res = await fetch(`/api/public/site/banners?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          console.error("[BannerSlider] Error HTTP al obtener banners:", res.status, res.statusText);
          setSlideImages([null, null, null]);
          return;
        }
        const json = await res.json();
        const images: string[] = Array.isArray(json?.images) ? json.images : [];
        const normalized = Array.from({ length: bannerSlides.length }, (_, i) => images[i] ?? null);
        console.log("[BannerSlider] Imágenes del endpoint:", normalized);
        setSlideImages(normalized);
      } catch (e) {
        console.error("[BannerSlider] Error inesperado al cargar banners:", e);
        setSlideImages([null, null, null]);
      }
    };
    load();
  }, []);

  // Auto-play del slider
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Reactivar auto-play después de 10 segundos
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <section className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden bg-gradient-to-r from-orange-50 to-orange-100">
      {/* Slides */}
      <div className="relative w-full h-full">
        {bannerSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 w-full h-full transition-all duration-700 ease-in-out",
              index === currentSlide ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
            )}
            style={{
              backgroundImage: `url(${slideImages[index] ?? "https://via.placeholder.com/1200x400?text=Banner"})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Background con overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/30 z-10" />
            
            {/* Contenido */}
            <div className="relative z-20 flex items-center justify-center h-full px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto text-center text-white">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                  {slide.title}
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl mb-2 text-orange-200">
                  {slide.subtitle}
                </p>
                <p className="text-base sm:text-lg mb-8 max-w-2xl mx-auto opacity-90">
                  {slide.description}
                </p>
                {/* Mostrar CTA solo si corresponde. Ocultar registro si está logueado */}
                {(() => {
                  const isRegisterCTA = slide.ctaLink === "/auth/register";
                  if (isRegisterCTA && isLoggedIn) return null;
                  return slide.ctaLink.startsWith('#') ? (
                    <Button 
                      size="lg" 
                      className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg"
                      onClick={() => {
                        document.querySelector(slide.ctaLink)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <ShoppingBag className="mr-2 h-5 w-5" />
                      {slide.cta}
                    </Button>
                  ) : (
                    <Link href={slide.ctaLink}>
                      <Button 
                        size="lg" 
                        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg"
                      >
                        <ShoppingBag className="mr-2 h-5 w-5" />
                        {slide.cta}
                      </Button>
                    </Link>
                  );
                })()}
              </div>
            </div>

            {/* Patrón decorativo */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white rounded-full" />
              <div className="absolute top-32 right-20 w-16 h-16 border-2 border-white rounded-full" />
              <div className="absolute bottom-20 left-32 w-12 h-12 border-2 border-white rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Controles de navegación */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-colors"
        aria-label="Slide anterior"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-colors"
        aria-label="Siguiente slide"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      {/* Indicadores */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
        {bannerSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              index === currentSlide 
                ? "bg-white scale-125" 
                : "bg-white/50 hover:bg-white/75"
            )}
            aria-label={`Ir al slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
