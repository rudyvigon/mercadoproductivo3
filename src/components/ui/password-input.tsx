import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends InputProps {
  toggleAriaLabel?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ toggleAriaLabel = "Mostrar u ocultar contraseña", className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          aria-label={toggleAriaLabel}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--info)]"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
