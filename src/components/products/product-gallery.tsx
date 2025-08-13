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

  const main = hasAny ? imgs[0] : null;

  return (
    <div className={className}>
      {/* Imagen principal */}
      {main ? (
        <div className="relative">
          <Image
            src={main}
            alt={title}
            width={900}
            height={700}
            className="h-auto w-full rounded-md object-cover cursor-zoom-in"
            onClick={() => openAt(0)}
            priority
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute right-2 top-2 z-10 bg-white/90 backdrop-blur text-gray-900 hover:bg-white"
            onClick={() => openAt(0)}
          >
            Galería
          </Button>
        </div>
      ) : (
        <div className="aspect-[4/3] w-full rounded-md bg-muted" />
      )}

      {/* Miniaturas */}
      {imgs.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {imgs.slice(1).map((url, idx) => (
            <Image
              key={idx}
              src={url}
              alt={`${title} ${idx + 2}`}
              width={300}
              height={200}
              className="h-24 w-full rounded object-cover cursor-zoom-in"
              onClick={() => openAt(idx + 1)}
            />
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
