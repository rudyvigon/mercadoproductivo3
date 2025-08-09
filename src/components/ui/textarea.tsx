import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06d04] focus-visible:border-[#f06d04] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // Error por aria-invalid
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-destructive/60 focus-visible:aria-[invalid=true]:ring-destructive/60 focus-visible:aria-[invalid=true]:border-destructive",
        // Éxito por data-success
        "data-[success=true]:border-emerald-500 data-[success=true]:ring-1 data-[success=true]:ring-emerald-500/50 focus-visible:data-[success=true]:ring-emerald-500/50 focus-visible:data-[success=true]:border-emerald-500",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
