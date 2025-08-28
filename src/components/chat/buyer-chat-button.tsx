"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import AuthGateModal from "@/components/auth/auth-gate-modal";
import BuyerConversationWindow from "@/components/chat/buyer-conversation-window";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic";
}

function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

export default function BuyerChatButton({
  sellerId,
  sellerPlanCode,
  sellerName,
  sellerAvatarUrl,
  size = "sm",
  className,
  buttonLabel = "Enviar Mensaje",
}: {
  sellerId: string;
  sellerPlanCode?: string | null;
  sellerName?: string | null;
  sellerAvatarUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
  buttonLabel?: string;
}) {
  const allowed = isAllowedPlan(sellerPlanCode);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [authedId, setAuthedId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoadingUser(true);
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setAuthedEmail(data.user?.email ?? null);
        setAuthedId(data.user?.id ?? null);
      } catch {
        // noop
      } finally {
        if (mounted) setLoadingUser(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!allowed) return null;

  const triggerSize = size === "sm" ? "h-8 px-2 py-1 text-xs" : "h-9 px-3 py-1.5 text-sm";

  return (
    <>
      <Button
        className={cn("inline-flex items-center gap-2", triggerSize, className)}
        onClick={() => {
          if (loadingUser) return;
          if (!authedEmail) {
            setAuthOpen(true);
            return;
          }
          if (authedId && authedId === sellerId) {
            toast.error("No puedes enviarte mensajes a ti mismo.");
            return;
          }
          setOpen(true);
        }}
      >
        <Mail className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>{buttonLabel}</span>
      </Button>
      <AuthGateModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Crear una cuenta"
        description="Necesitas una cuenta para chatear con el vendedor."
        registerHref="/auth/register"
      />
      {authedEmail && (
        <BuyerConversationWindow
          open={open}
          onOpenChange={setOpen}
          sellerId={sellerId}
          sellerName={sellerName}
          sellerAvatarUrl={sellerAvatarUrl || undefined}
          currentUserEmail={authedEmail}
        />
      )}
    </>
  );
}
