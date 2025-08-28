"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [featureCost, setFeatureCost] = useState<number | null>(null); // costo por día
  const [loadingPlan, setLoadingPlan] = useState<boolean>(true);
  const [maxDays, setMaxDays] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(defaultDays);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [openUnfeature, setOpenUnfeature] = useState(false);

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
          .select('plan_code, plan_renews_at, plan_activated_at, updated_at, credits_balance')
          .eq('id', user.id)
          .single();
        const planCode = (profile?.plan_code || '').toString();

        // Calcular días restantes de suscripción
        const now = new Date();
        let renewsAt: Date | null = null;
        if ((profile as any)?.plan_renews_at) {
          const d = new Date((profile as any).plan_renews_at);
          if (!Number.isNaN(d.getTime())) renewsAt = d;
        }
        if (!renewsAt && (profile as any)?.plan_activated_at) {
          const d = new Date((profile as any).plan_activated_at);
          if (!Number.isNaN(d.getTime())) {
            d.setMonth(d.getMonth() + 1);
            renewsAt = d;
          }
        }
        if (!renewsAt && (profile as any)?.updated_at && planCode) {
          const d = new Date((profile as any).updated_at);
          if (!Number.isNaN(d.getTime())) {
            d.setMonth(d.getMonth() + 1);
            renewsAt = d;
          }
        }
        if (renewsAt) {
          const ms = renewsAt.getTime() - now.getTime();
          const days = Math.max(0, Math.ceil(ms / 86400000));
          setMaxDays(days || 1);
        } else {
          setMaxDays(30); // fallback conservador
        }
        setCreditsBalance((profile as any)?.credits_balance ?? null);

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

  // Ajustar días por defecto en cuanto conocemos el límite
  useEffect(() => {
    if (maxDays != null) {
      setSelectedDays((d) => Math.min(Math.max(1, d || 1), Math.max(1, maxDays)));
    }
  }, [maxDays]);

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, days: selectedDays }),
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

  const onUnfeatureConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error: updErr } = await supabase
        .from('products')
        .update({ featured_until: null })
        .eq('id', productId)
        .eq('user_id', user.id);
      if (updErr) throw updErr;
      setOpenUnfeature(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "No se pudo quitar el destacado");
    } finally {
      setLoading(false);
    }
  };

  // Si el producto ya está destacado, mostrar botón deshabilitado
  if (isFeatured) {
    return (
      <Dialog open={openUnfeature} onOpenChange={setOpenUnfeature}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
            Quitar destacado
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar destacado</DialogTitle>
            <DialogDescription>
              El producto dejará de aparecer en la sección de destacados.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenUnfeature(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={onUnfeatureConfirm} disabled={loading} variant="destructive">
              {loading ? "Procesando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  const perDay = featureCost ?? cost;
  const totalCredits = (perDay || 0) * (selectedDays || 0);
  const maxAllowed = maxDays ?? 1;
  const insufficient = creditsBalance != null && totalCredits > creditsBalance;
  const invalidDays = selectedDays < 1 || selectedDays > maxAllowed;

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
            Elige por cuántos días destacar. Costo por día: <b>{perDay}</b> crédito(s).
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-2 py-1">
          <label className="text-sm font-medium">Días</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={maxAllowed}
              value={selectedDays}
              onChange={(e) => setSelectedDays(Math.max(1, Math.min(Number(e.target.value || 1), maxAllowed)))}
              className="w-24"
            />
            <div className="text-xs text-muted-foreground">máx. {maxAllowed} día(s)</div>
          </div>
          <div className="text-sm">
            Total: <b>{totalCredits}</b> crédito(s)
          </div>
          {creditsBalance != null && (
            <div className="text-xs text-muted-foreground">Saldo disponible: {creditsBalance}</div>
          )}
          {insufficient && (
            <div className="text-xs text-red-600">Créditos insuficientes para esta operación.</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={loading || invalidDays || insufficient}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {loading ? "Procesando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

