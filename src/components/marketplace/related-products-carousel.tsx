"use client";

import { useRef, useState, useEffect, PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

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
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    setDragging(false);
    el.releasePointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    // No arrows/dots: solo asegurar que el scroller exista para drag
  }, [items?.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Más productos de este vendedor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Scroller */}
          <div
            ref={scrollerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ touchAction: "pan-y" }}
          >
            <div className="flex gap-4 pr-2">
              {items.map((rp) => {
                const cover = rp.product_images?.[0]?.url ?? null;
                return (
                  <Link
                    key={rp.id}
                    href={`/products/${rp.id}`}
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
