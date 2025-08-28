"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNormalizedRoleFromUser } from "@/lib/auth/role";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type SubscribeButtonProps = {
  code: string;
  interval: "monthly" | "yearly";
  children: React.ReactNode;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
};

export function SubscribeButton({ code, interval, children, className, variant = "default", size }: SubscribeButtonProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [switchingRole, setSwitchingRole] = useState(false);

  const performSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/billing/mp/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, interval }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        const next = `/planes?interval=${encodeURIComponent(interval)}`;
        window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
        return;
      }

      if (!res.ok) {
        const err = (json as any)?.error || "SUBSCRIBE_FAILED";
        const eff = (json as any)?.details?.plan_pending_effective_at as string | undefined;
        const pend = (json as any)?.details?.plan_pending_code as string | undefined;
        const detRaw = (json as any)?.details;
        const det = typeof detRaw === "string" ? detRaw : detRaw ? JSON.stringify(detRaw) : undefined;
        let dest = `/dashboard/plan/failure?error=${encodeURIComponent(err)}`;
        if (eff) dest += `&effective_at=${encodeURIComponent(eff)}`;
        if (pend) dest += `&pending=${encodeURIComponent(pend)}`;
        if (det) dest += `&detail=${encodeURIComponent(det)}`;
        window.location.href = dest;
        return;
      }

      const redirectUrl = (json as any)?.redirect_url as string | undefined;
      if (redirectUrl && redirectUrl.length > 0) {
        window.location.href = redirectUrl;
        return;
      }
      window.location.href = "/dashboard/plan/success";
    } catch {
      window.location.href = "/dashboard/plan/failure?error=NETWORK_ERROR";
    } finally {
      // mantenemos loading para evitar doble clic durante la navegación
    }
  };

  const handleClick = async () => {
    if (loading) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = getNormalizedRoleFromUser(user);
        if (role === "buyer") {
          setModalStep(1);
          setShowBuyerModal(true);
          return;
        }
      }
    } catch {
      // ignoramos y continuamos
    }
    await performSubscribe();
  };

  async function onConfirmSwitchToSeller() {
    if (switchingRole) return;
    setSwitchingRole(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setShowBuyerModal(false);
        await performSubscribe();
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({
        data: { role: "seller", user_type: "anunciante" },
      });
      if (updErr) throw updErr;

      // Asegurar fila en profiles y plan_code por defecto si falta
      try {
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("plan_code")
          .eq("id", user.id)
          .single();
        const plan = (prof as any)?.plan_code as string | null | undefined;
        if ((pErr && pErr.code === "PGRST116") || !plan || String(plan).trim().length === 0) {
          await supabase
            .from("profiles")
            .upsert({ id: user.id, plan_code: "free", updated_at: new Date().toISOString() }, { onConflict: "id" });
        }
      } catch {}

      try { window.dispatchEvent(new CustomEvent("profile:updated", { detail: { role: "seller" } })); } catch {}
      toast.success("Tu perfil ahora es de vendedor");
      setShowBuyerModal(false);
      await performSubscribe();
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo cambiar tu perfil a vendedor. Intenta nuevamente.");
    } finally {
      setSwitchingRole(false);
    }
  }

  return (
    <>
      <Button onClick={handleClick} disabled={loading} className={className} variant={variant} size={size} aria-busy={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando...
          </span>
        ) : (
          children
        )}
      </Button>

      <Dialog open={showBuyerModal} onOpenChange={(o) => { if (!switchingRole) { setShowBuyerModal(o); if (!o) setModalStep(1); } }}>
        <DialogContent>
          {modalStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Planes disponibles solo para vendedores</DialogTitle>
                <DialogDescription>
                  Actualmente tu perfil es de comprador. Para contratar un plan y publicar productos, primero debés cambiar tu perfil a vendedor.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBuyerModal(false)} disabled={switchingRole}>
                  Cancelar
                </Button>
                <Button onClick={() => setModalStep(2)} disabled={switchingRole}>
                  Cambiar a vendedor
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>¿Confirmás cambiar a vendedor?</DialogTitle>
                <DialogDescription>
                  Este cambio es irreversible: no podrás volver a comprador. Se actualizará tu perfil a vendedor y podrás continuar con la suscripción al plan seleccionado.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalStep(1)} disabled={switchingRole}>
                  Volver
                </Button>
                <Button onClick={onConfirmSwitchToSeller} disabled={switchingRole}>
                  {switchingRole ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Actualizando...
                    </span>
                  ) : (
                    "Sí, cambiar y continuar"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

