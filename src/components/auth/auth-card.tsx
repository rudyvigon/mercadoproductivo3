import { cn } from "@/lib/utils";

export default function AuthCard({
  title,
  subtitle,
  bottomSlot,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  bottomSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-md md:p-8",
        "ring-1 ring-border",
        className
      )}
    >
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
      {bottomSlot && (
        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-foreground/80">
          {bottomSlot}
        </div>
      )}
    </div>
  );
}
