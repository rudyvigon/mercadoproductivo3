"use client";

import Link from "next/link";

export function AuthLeftHero() {
  return (
    <div className="relative overflow-hidden w-full h-full">
      {/* Fondo base con gradiente direccional y overlay para contraste */}
      <div className="absolute inset-0 bg-[linear-gradient(40deg,rgb(249,115,22),rgb(37,99,235))]" />
      <div className="absolute inset-0 bg-black/30" />

      {/* Contenido: marca + bullets */}
      <div className="relative z-10 flex h-full flex-col justify-center items-start text-white p-12 w-full">
          <div className="text-left space-y-6 max-w-xl">
            <Link href="/" className="inline-flex items-center mb-2 text-base font-semibold tracking-tight text-white">
              Mercado Productivo
            </Link>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-bold leading-tight text-white">
                Conecta directamente con
                <br />
                <span className="bg-gradient-to-r from-orange-300 to-amber-200 bg-clip-text text-transparent">productores confiables</span>
              </h1>
              <p className="text-lg text-blue-100 max-w-md">
                La plataforma B2B que elimina intermediarios y reduce costos operativos
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 max-w-sm text-left">
              <div className="flex items-center gap-3 text-blue-100">
                <span className="inline-block w-2 h-2 bg-orange-300 rounded-full" />
                <span>Acceso directo a productores verificados</span>
              </div>
              <div className="flex items-center gap-3 text-blue-100">
                <span className="inline-block w-2 h-2 bg-orange-300 rounded-full" />
                <span>Precios competitivos sin intermediarios</span>
              </div>
              <div className="flex items-center gap-3 text-blue-100">
                <span className="inline-block w-2 h-2 bg-orange-300 rounded-full" />
                <span>Comunicación directa y transparente</span>
              </div>
            </div>
          </div>
        </div>

      {/* Elementos decorativos sutiles (alineados a la derecha) */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full" />
      <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-orange-300/20 rounded-full" />
      <div className="absolute top-1/2 right-10 w-16 h-16 bg-blue-300/20 rounded-full" />

      {/* Separador vertical sutil entre columnas */}
      <div className="absolute inset-y-0 right-0 w-px bg-white/20" />
    </div>
  );
}
