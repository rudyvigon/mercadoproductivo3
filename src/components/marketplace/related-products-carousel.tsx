"use client";

import { useRef, useState, useEffect, PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ChevronLeft, ChevronRight } from "lucide-react";

interface RelatedProductItem {
  id: string;
  title: string;
  price: number;
  quantity_unit: string;
  category: string;
  product_images?: { url: string }[];
}

export function RelatedProductsCarousel({ items }: { items: RelatedProductItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef<{ startX: number; scrollLeft: number }>({ startX: 0, scrollLeft: 0 });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    setDragging(true);
    el.setPointerCapture?.(e.pointerId);
    posRef.current.startX = e.clientX;
    posRef.current.scrollLeft = el.scrollLeft;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || !dragging) return;
    e.preventDefault();
    const delta = e.clientX - posRef.current.startX;
    el.scrollLeft = posRef.current.scrollLeft - delta;
    updateButtons();
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    setDragging(false);
    el.releasePointerCapture?.(e.pointerId);
  };

  const updateButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    setCanLeft(left > 2);
    setCanRight(maxScroll - left > 2);
  };

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => updateButtons();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [items?.length]);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Más productos de este vendedor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Degradados laterales para resaltar flechas */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 z-50 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 z-50 bg-gradient-to-l from-white to-transparent" />

          {/* Flechas */}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-50 h-10 w-10 md:h-11 md:w-11 rounded-full shadow-lg bg-white ${canLeft ? 'text-orange-600 hover:text-orange-700' : 'text-gray-400'} ring-1 ring-black/10 hover:bg-white ${canLeft ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => scrollByAmount("left")}
            disabled={!canLeft}
            aria-label="Desplazar a la izquierda"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-50 h-10 w-10 md:h-11 md:w-11 rounded-full shadow-lg bg-white ${canRight ? 'text-orange-600 hover:text-orange-700' : 'text-gray-400'} ring-1 ring-black/10 hover:bg-white ${canRight ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => scrollByAmount("right")}
            disabled={!canRight}
            aria-label="Desplazar a la derecha"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Scroller */}
          <div
            ref={scrollerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onScroll={updateButtons}
            className={`overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ touchAction: "pan-y" }}
          >
            <div className="flex gap-4 pr-2">
              {items.map((rp) => {
                const cover = rp.product_images?.[0]?.url ?? null;
                return (
                  <Link
                    key={rp.id}
                    href={`/marketplace/product/${rp.id}`}
                    className="snap-start shrink-0 w-64 rounded-lg border hover:shadow transition bg-white overflow-hidden"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      {cover ? (
                        <Image src={cover} alt={rp.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <h5 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{rp.title}</h5>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">{rp.category}</Badge>
                        <span className="text-sm font-semibold text-orange-600">
                          {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(rp.price)}
                          <span className="text-gray-500"> / {rp.quantity_unit}</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
