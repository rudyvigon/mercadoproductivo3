"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import BuyerChatWindow from "@/components/chat/buyer-chat-window";
import AuthGateModal from "@/components/auth/auth-gate-modal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic"; // free/basic/gratis
}

function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

export type ContactFormButtonProps = {
  sellerPlanCode?: string | null;
  sellerId: string;
  sellerName?: string | null;
  productTitle?: string | null;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  currentUserPhone?: string | null;
  size?: "sm" | "md";
  className?: string;
  buttonLabel?: string;
  onSubmitted?: (payload: {
    nombre: string;
    email: string;
    telefono: string;
    asunto: string;
    mensaje: string;
    sellerId: string;
  }) => void;
};

export default function ContactFormButton({
  sellerPlanCode,
  sellerId,
  sellerName,
  productTitle,
  currentUserName,
  currentUserEmail,
  currentUserPhone,
  size = "sm",
  className,
  buttonLabel = "Enviar formulario",
  onSubmitted,
}: ContactFormButtonProps) {
  const allowed = isAllowedPlan(sellerPlanCode);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authedEmail, setAuthedEmail] = useState<string | null>(currentUserEmail ?? null);
  const [authedId, setAuthedId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  // Detectar sesión del usuario cliente
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
          // Evitar auto-contacto si el usuario autenticado es el mismo vendedor
          if (authedId && authedId === sellerId) {
            toast.error("No puedes enviarte mensajes a ti mismo.");
            return;
          }
          // Si no está logueado, abrir modal de registro
          if (!authedEmail) {
            setAuthOpen(true);
            return;
          }
          // Usuario autenticado → abrir modal de contacto (por ahora formulario)
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
        description="Necesitas una cuenta para usar el chat y contactar a vendedores."
        registerHref="/auth/register"
      />
      <BuyerChatWindow
        open={open}
        onOpenChange={setOpen}
        sellerPlanCode={sellerPlanCode}
        sellerId={sellerId}
        sellerName={sellerName}
        productTitle={productTitle}
        currentUserName={currentUserName}
        currentUserEmail={authedEmail || currentUserEmail}
        currentUserPhone={currentUserPhone}
        onSubmitted={onSubmitted}
      />
    </>
  );
}

