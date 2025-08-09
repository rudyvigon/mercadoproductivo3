"use client";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Borde más notorio y foco naranja por defecto (mayor contraste)
      "peer h-4 w-4 shrink-0 rounded-sm border border-[var(--border-light)] bg-[var(--bg-subtle)] text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06d04] focus-visible:border-[#f06d04]",
      // Error y éxito (prioridad sobre foco naranja)
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-destructive/60 focus-visible:aria-[invalid=true]:ring-destructive/60 focus-visible:aria-[invalid=true]:border-destructive",
      "data-[success=true]:border-emerald-500 data-[success=true]:ring-1 data-[success=true]:ring-emerald-500/50 focus-visible:data-[success=true]:ring-emerald-500/50 focus-visible:data-[success=true]:border-emerald-500",
      "disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className="flex items-center justify-center text-current"
      asChild
    >
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
