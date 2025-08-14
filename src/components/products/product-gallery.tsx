"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  title: string;
  className?: string;
};

export function ProductGallery({ images, title, className }: Props) {
  const imgs = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const hasAny = imgs.length > 0;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = useCallback((i: number) => {
    if (!hasAny) return;
    setIndex(Math.max(0, Math.min(i, imgs.length - 1)));
    setOpen(true);
  }, [hasAny, imgs.length]);

  const next = useCallback(() => setIndex((i) => (i + 1) % Math.max(imgs.length, 1)), [imgs.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + Math.max(imgs.length, 1)) % Math.max(imgs.length, 1)), [imgs.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev]);

  const activeSrc = hasAny ? imgs[index] : null;

  return (
    <div className={`${className ?? ''} w-full overflow-hidden`}>
      {/* Layout estilo Mercado Libre: thumbs verticales + imagen principal */}
      <div className="flex gap-3 sm:gap-4 min-w-0 overflow-hidden">
        {/* Thumbs verticales (desktop) */}
        {hasAny ? (
          <div
            className="hidden sm:flex w-16 shrink-0 flex-col gap-2 overflow-y-auto max-h-[540px] px-1.5 py-2
            [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {imgs.map((url, idx) => (
              <div key={idx} className="relative group">
                <button
                  type="button"
                  onClick={() => setIndex(idx)}
                  className={`relative aspect-square w-12 overflow-hidden rounded-md border border-gray-200 bg-white p-1 mx-0.5 ${
                    idx === index ? "ring-2 ring-orange-500 border-orange-200" : "hover:ring-1 hover:ring-gray-300"
                  }`}
                >
                  <div className="relative h-full w-full rounded-sm bg-white">
                    <Image
                      src={url}
                      alt={`${title} miniatura ${idx + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Imagen principal */}
        <div className="relative flex-1 min-w-0">
          {activeSrc ? (
            <div className="relative w-full overflow-hidden rounded-lg border bg-white">
              <div className="relative aspect-[4/3]">
                <Image
                  src={activeSrc}
                  alt={`${title} imagen ${index + 1}`}
                  fill
                  priority
                  className="object-contain bg-white"
                />
              </div>

              {/* Controles superpuestos removidos por solicitud */}
            </div>
          ) : (
            <div className="aspect-[4/3] w-full rounded-md bg-muted" />
          )}
        </div>
      </div>

      {/* Thumbs horizontales (mobile) */}
      {hasAny && imgs.length > 1 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto sm:hidden px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {imgs.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setIndex(idx)}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white p-1 mx-1 ${
                idx === index ? "ring-2 ring-orange-500 border-orange-200" : "hover:ring-1 hover:ring-gray-300"
              }`}
            >
              <div className="relative h-full w-full rounded-sm bg-white">
                <Image
                  src={url}
                  alt={`${title} miniatura ${idx + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            </button>
          ))}
        </div>
      )}


      {/* Modal Preview */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <div className="relative w-full" style={{ minHeight: "50vh" }}>
            {hasAny && (
              <Image
                src={imgs[index]}
                alt={`${title} preview ${index + 1}`}
                fill
                className="rounded bg-black object-contain"
                priority
              />
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button type="button" variant="outline" onClick={prev} disabled={imgs.length <= 1}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
            <div className="text-xs text-muted-foreground">{index + 1} / {imgs.length}</div>
            <Button type="button" variant="outline" onClick={next} disabled={imgs.length <= 1}>
              Siguiente <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
