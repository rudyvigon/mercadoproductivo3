"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
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
      // No quitamos el loading para evitar dobles clics mientras navega
    }
  };

  return (
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
  );
}
