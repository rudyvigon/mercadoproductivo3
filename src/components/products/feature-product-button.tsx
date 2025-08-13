"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function FeatureProductButton({
  productId,
  defaultDays = 7,
  cost = 10,
  featuredUntil,
}: {
  productId: string;
  defaultDays?: number;
  cost?: number;
  featuredUntil?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);

  // Actualizar estado destacado cuando cambia featuredUntil
  useEffect(() => {
    if (featuredUntil) {
      const isCurrentlyFeatured = new Date(featuredUntil) > new Date();
      setIsFeatured(isCurrentlyFeatured);
    } else {
      setIsFeatured(false);
    }
  }, [featuredUntil]);

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, days: defaultDays, cost }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo destacar el producto");
      }
      setOpen(false);
      router.refresh(); // Forzar recarga de datos
    } catch (e: any) {
      setError(e.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  // Si el producto ya está destacado, mostrar botón deshabilitado
  if (isFeatured) {
    return (
      <Button 
        size="sm" 
        className="bg-green-100 text-green-700 hover:bg-green-100/80"
        disabled
      >
        <Check className="mr-1 h-4 w-4" />
        Destacado
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600">
          Destacar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Destacar producto</DialogTitle>
          <DialogDescription>
            Usará {cost} crédito(s) y destacará el producto por {defaultDays} día(s).
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={loading} 
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {loading ? "Procesando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
