"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface MenuActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

// Botón estilo referencia (anchor de RedirectErrorBoundary):
// blanco, borde naranja, texto naranja, hover bg naranja translúcido
export const MenuActionButton = React.forwardRef<
  HTMLButtonElement,
  MenuActionButtonProps
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : ("button" as any);
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        "shadow-sm hover:text-accent-foreground h-8 rounded-md px-3 text-xs min-w-[80px]",
        "bg-white text-[#f06d04] border border-[#f06d04] hover:bg-[#f06d04]/10",
        className
      )}
      {...props}
    />
  );
});
MenuActionButton.displayName = "MenuActionButton";

// Variante llena (naranja), por si se requiere en otras vistas
export const MenuActionPrimaryButton = React.forwardRef<
  HTMLButtonElement,
  MenuActionButtonProps
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : ("button" as any);
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
        "transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        "shadow-sm h-8 rounded-md px-3 text-xs min-w-[80px]",
        "bg-[#f06d04] text-white border border-[#f06d04] hover:opacity-95",
        className
      )}
      {...props}
    />
  );
});
MenuActionPrimaryButton.displayName = "MenuActionPrimaryButton";
