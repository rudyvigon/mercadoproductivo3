"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import confirmModal from "@/components/ui/confirm-modal";

export default function CancelSubscriptionButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState<"none" | "end">("none");

  const callCancel = async (mode: "at_period_end") => {
    setLoading("end");
    try {
      const res = await fetch("/api/billing/mp/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) {
        // Redirigir con indicador si MP no se pudo cancelar (evitar cobros recurrentes)
        const mpOk = data?.cancelled !== false;
        const suffix = mpOk ? "" : "&mp=0";
        window.location.assign(`/dashboard/plan?cancel=1${suffix}`);
        return;
      }
      alert(`Error al cancelar: ${data?.error || res.statusText}`);
    } catch (e: any) {
      alert(`Error al cancelar: ${e?.message || "Unknown"}`);
    } finally {
      setLoading("none");
    }
  };

  const onCancelAtEnd = async () => {
    const ok = await confirmModal({
      title: "Cancelar suscripción",
      description:
        "Se cancelará la suscripción y el plan cambiará a 'free' al finalizar tu ciclo actual. ¿Deseas continuar?",
      confirmText: "Sí, cancelar al fin de ciclo",
      cancelText: "No, volver",
    });
    if (!ok) return;
    await callCancel("at_period_end");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="destructive"
        className="bg-red-600 text-white hover:bg-red-700"
        onClick={onCancelAtEnd}
        disabled={disabled || loading !== "none"}
      >
        {loading === "end" ? "Cancelando..." : "Cancelar suscripción"}
      </Button>
    </div>
  );
}
