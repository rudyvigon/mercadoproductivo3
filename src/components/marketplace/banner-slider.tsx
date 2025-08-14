"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const bannerSlides = [
  {
    id: 1,
    title: "Conectamos Productores y Compradores",
    subtitle: "La plataforma líder del sector agroindustrial",
    description: "Descubre productos frescos directamente del campo a tu mesa",
    image: "/api/placeholder/1200/400",
    cta: "Explorar Productos",
    ctaLink: "#productos"
  },
  {
    id: 2,
    title: "Productos Destacados del Mes",
    subtitle: "Calidad garantizada",
    description: "Los mejores productos seleccionados por nuestros expertos",
    image: "/api/placeholder/1200/400",
    cta: "Ver Destacados",
    ctaLink: "#destacados"
  },
  {
    id: 3,
    title: "Únete a Nuestra Comunidad",
    subtitle: "Más de 1000 productores confían en nosotros",
    description: "Forma parte del marketplace agroindustrial más grande",
    image: "/api/placeholder/1200/400",
    cta: "Registrarse",
    ctaLink: "/auth/register"
  }
];

export default function BannerSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-play del slider
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
    }, 5000);

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
{slide.ctaLink.startsWith('#') ? (
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
                )}
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

      {/* Stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center text-white">
            <div className="flex flex-col items-center">
              <TrendingUp className="h-6 w-6 mb-2 text-orange-400" />
              <span className="text-2xl font-bold">1000+</span>
              <span className="text-sm opacity-80">Productos</span>
            </div>
            <div className="flex flex-col items-center">
              <Users className="h-6 w-6 mb-2 text-orange-400" />
              <span className="text-2xl font-bold">500+</span>
              <span className="text-sm opacity-80">Productores</span>
            </div>
            <div className="flex flex-col items-center">
              <ShoppingBag className="h-6 w-6 mb-2 text-orange-400" />
              <span className="text-2xl font-bold">2000+</span>
              <span className="text-sm opacity-80">Ventas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
