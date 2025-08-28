"use client";

import React from "react";
import { Heart } from "lucide-react";
import confirmModal from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";

function isPaidPlan(plan?: string | null) {
  const c = String(plan || "").toLowerCase();
  return (
    c.includes("plus") ||
    c.includes("deluxe") ||
    c.includes("diamond") ||
    c === "premium" ||
    c === "pro" ||
    c === "enterprise"
  );
}

type Props = {
  sellerId: string;
  planCode?: string | null;
  initialLikes?: number;
  className?: string;
  size?: "sm" | "md";
};

export default function SellerLikeButton({ sellerId, planCode, initialLikes = 0, className, size = "md" }: Props) {
  const [liked, setLiked] = React.useState<boolean>(false);
  const [likesCount, setLikesCount] = React.useState<number>(initialLikes);
  const [loading, setLoading] = React.useState<boolean>(false);
  const mountedRef = React.useRef(false);

  const paid = isPaidPlan(planCode);

  React.useEffect(() => {
    let active = true;
    // Cargar estado actual (liked y conteo)
    async function load() {
      try {
        const res = await fetch(`/api/likes/${sellerId}`, { cache: "no-store" });
        if (!res.ok) return; // Mantener initialLikes
        const json = await res.json();
        if (!active) return;
        if (typeof json.likes_count === "number") setLikesCount(json.likes_count);
        if (typeof json.liked === "boolean") setLiked(json.liked);
      } catch {}
    }
    if (!mountedRef.current) {
      mountedRef.current = true;
      load();
    }
    return () => {
      active = false;
    };
  }, [sellerId]);

  const handleClick = React.useCallback(async () => {
    if (!paid) return; // Sólo visible en planes pagos, evitar interacción
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/likes/${sellerId}`, { method: "POST" });
      if (res.status === 401) {
        // Pedir registro/login
        const ok = await confirmModal({
          title: "Inicia sesión para dar like",
          description: "Debes iniciar sesión o registrarte para poder dar like a este perfil.",
          confirmText: "Ir a registrarme",
          cancelText: "Cancelar",
        });
        if (ok) {
          const url = typeof window !== "undefined" ? window.location.pathname : "/";
          window.location.href = `/auth/register?redirect=${encodeURIComponent(url)}`;
        }
        return;
      }
      if (res.status === 403) {
        await confirmModal({
          title: "Likes no disponibles",
          description: "Este vendedor no tiene un plan que habilite recibir likes.",
          confirmText: "Entendido",
          cancelText: "Cerrar",
        });
        return;
      }
      if (res.status === 404) {
        await confirmModal({
          title: "Vendedor no encontrado",
          description: "No pudimos encontrar este perfil. Intenta nuevamente más tarde.",
          confirmText: "Entendido",
          cancelText: "Cerrar",
        });
        return;
      }
      if (res.status === 400) {
        let err: any = null;
        try {
          err = await res.json();
        } catch {}
        if (err?.error === "SELF_LIKE_FORBIDDEN") {
          await confirmModal({
            title: "Acción no permitida",
            description: "No puedes darte like a ti mismo.",
            confirmText: "Entendido",
            cancelText: "Cerrar",
          });
        }
        return;
      }
      if (!res.ok) return; // Error genérico, no aplicar cambios
      const json = await res.json();
      if (typeof json.liked === "boolean") setLiked(json.liked);
      if (typeof json.likes_count === "number") setLikesCount(json.likes_count);
    } catch {
      // Silenciar errores de red puntuales
    } finally {
      setLoading(false);
    }
  }, [sellerId, paid, loading]);

  if (!paid) {
    // No mostrar para planes gratuitos
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
        liked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className
      )}
      aria-pressed={liked}
      aria-label={liked ? "Quitar like" : "Dar like"}
    >
      <Heart
        className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", liked ? "text-rose-600" : "text-gray-500")}
        fill={liked ? "currentColor" : "none"}
      />
      <span className={cn("tabular-nums", liked ? "text-rose-700" : "text-gray-700")}>{likesCount}</span>
    </button>
  );
}
