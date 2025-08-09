import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md px-3 py-2 text-sm outline-none transition",
          // Base palette
          "bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-50",
          // Borders and focus (default orange)
          "border border-[var(--border-light)] focus:ring-2 focus:ring-[#f06d04] focus:border-[#f06d04]",
          // Error state via aria-invalid
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/50 focus:aria-[invalid=true]:ring-destructive/60",
          // Success state via data-success
          "data-[success=true]:border-emerald-500 data-[success=true]:ring-2 data-[success=true]:ring-emerald-500/40 focus:data-[success=true]:ring-emerald-500/50",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
