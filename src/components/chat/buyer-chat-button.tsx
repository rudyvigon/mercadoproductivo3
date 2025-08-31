"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import BuyerConversationWindow from "@/components/chat/buyer-conversation-window";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = useMemo(() => createClient(), []);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setSelfId(data?.user?.id || null);
      } catch {
        setSelfId(null);
      }
    })();
  }, [supabase]);

  const isSelf = selfId && String(selfId) === String(sellerId);

  if (!allowed) return null;

  const triggerSize = size === "sm" ? "h-8 px-2 py-1 text-xs" : "h-9 px-3 py-1.5 text-sm";

  return (
    <>
      <Button
        className={cn("inline-flex items-center gap-2", triggerSize, className)}
        onClick={() => !isSelf && setOpen(true)}
        disabled={!!isSelf}
        title={isSelf ? "No puedes enviarte mensajes a ti mismo" : undefined}
      >
        <Mail className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>{buttonLabel}</span>
      </Button>
      <BuyerConversationWindow
        open={open}
        onOpenChange={setOpen}
        sellerId={sellerId}
        sellerName={sellerName || undefined}
        sellerAvatarUrl={sellerAvatarUrl || undefined}
        currentUserEmail={""}
      />
    </>
  );
}

