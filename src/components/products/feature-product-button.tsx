"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  defaultDays = 3,
  cost = 10,
  featuredUntil,
}: {
  productId: string;
  defaultDays?: number;
  cost?: number;
  featuredUntil?: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [canFeature, setCanFeature] = useState<boolean>(true);
  const [featureCost, setFeatureCost] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(true);

  // Actualizar estado destacado cuando cambia featuredUntil
  useEffect(() => {
    if (featuredUntil) {
      const isCurrentlyFeatured = new Date(featuredUntil) > new Date();
      setIsFeatured(isCurrentlyFeatured);
    } else {
      setIsFeatured(false);
    }
  }, [featuredUntil]);

  // Cargar permisos y costo desde `plans` según plan del usuario
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_code')
          .eq('id', user.id)
          .single();
        const planCode = (profile?.plan_code || '').toString();
        if (!planCode) {
          setCanFeature(true);
          setFeatureCost(cost);
          return;
        }
        const { data: plan } = await supabase
          .from('plans')
          .select('can_feature, feature_cost')
          .eq('code', planCode)
          .maybeSingle();
        setCanFeature(Boolean((plan as any)?.can_feature ?? true));
        const fc: any = (plan as any)?.feature_cost;
        setFeatureCost(typeof fc === 'number' ? fc : (fc ? Number(fc) : cost));
      } catch {
        setCanFeature(true);
        setFeatureCost(cost);
      } finally {
        setLoadingPlan(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, cost]);

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const effectiveCost = featureCost ?? cost;
      const res = await fetch("/api/products/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, days: defaultDays, cost: effectiveCost }),
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

  // Mientras cargamos el plan
  if (loadingPlan) {
    return (
      <Button size="sm" variant="outline" disabled>
        Cargando...
      </Button>
    );
  }

  // Si el plan no permite destacar
  if (!canFeature) {
    return (
      <Button size="sm" variant="outline" disabled title="Tu plan no permite destacar productos">
        Destacar
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
            Usará {featureCost ?? cost} crédito(s) y destacará el producto por {defaultDays} día(s).
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
