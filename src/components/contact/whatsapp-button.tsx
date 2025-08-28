import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic"; // free/basic/gratis
}

function normalizePhone(phone?: string | null) {
  const p = String(phone || "");
  const digits = p.replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits : "";
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("h-4 w-4", className)} aria-hidden>
      <path d="M16.001 3C9.374 3 4 8.373 4 15c0 2.184.585 4.23 1.603 5.997L4 29l8.207-1.571A11.93 11.93 0 0016 27c6.627 0 12-5.373 12-12S22.628 3 16.001 3z" fill="#25D366"/>
      <path d="M12.332 10.667c-.245 0-.55.018-.843.404-.293.386-1.11 1.084-1.11 2.636 0 1.552 1.137 3.053 1.297 3.263.16.211 2.189 3.524 5.393 4.667 3.204 1.144 3.068.787 3.622.756.554-.03 1.788-.73 2.041-1.44.253-.71.253-1.318.182-1.447-.07-.128-.278-.206-.58-.361-.302-.154-1.788-.883-2.066-.983-.278-.1-.48-.154-.68.155-.2.31-.78.983-.955 1.185-.175.201-.35.226-.652.077-.302-.15-1.27-.465-2.42-1.482-1.078-.944-1.806-2.11-2.016-2.412-.21-.302-.022-.465.127-.615.13-.13.302-.34.45-.509.148-.169.197-.292.297-.495.1-.204.05-.381-.025-.536-.076-.155-.66-1.641-.93-2.246-.271-.605-.56-.585-.806-.585z" fill="#fff"/>
    </svg>
  );
}

export type WhatsAppButtonProps = {
  sellerPlanCode?: string | null;
  sellerPhone?: string | null;
  productTitle?: string | null;
  currentUserName?: string | null;
  size?: "sm" | "md";
  className?: string;
};

export default function WhatsAppButton({ sellerPlanCode, sellerPhone, productTitle, currentUserName, size = "sm", className }: WhatsAppButtonProps) {
  const tier = planTier(sellerPlanCode);
  const phone = normalizePhone(sellerPhone);

  if (tier !== "deluxe" || !phone) return null;

  const name = (currentUserName || "").trim() || "un comprador";
  const product = (productTitle || "").trim() || "tu producto";
  const message = `Hola 👋 Soy ${name} , vengo desde Mercado Productivo porque estoy interesado en ${product}`;
  const href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

  return (
    <Button asChild className={cn(
      "inline-flex items-center gap-2 bg-white text-[#25D366] border border-[#25D366] hover:bg-[#25D366]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/40",
      size === "sm" ? "h-8 px-2 py-1 text-xs" : "h-9 px-3 py-1.5 text-sm",
      className
    )}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp">
        <WhatsAppIcon />
        <span>WhatsApp</span>
      </a>
    </Button>
  );
}
