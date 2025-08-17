import { Badge } from "@/components/ui/badge";
import { Award, Gem, Crown } from "lucide-react";

function planCodeToLabel(code?: string | null) {
  const c = String(code || "").toLowerCase();
  if (c === "free" || c === "basic") return "Básico";
  if (c === "plus" || c === "enterprise") return "Plus";
  if (c === "deluxe") return "Deluxe";
  return "Básico";
}

export default function PlanBadge({
  planLabel,
  planCode,
  className,
}: {
  planLabel?: string | null;
  planCode?: string | null;
  className?: string;
}) {
  const label = (planLabel || planCodeToLabel(planCode) || "").toString();
  const norm = label.trim();
  // Remover prefijo "Plan " si viene en el label para normalizar
  const stripped = norm.replace(/^plan\s+/i, "");
  const normLower = stripped.toLowerCase();

  // Clases por defecto (Básico)
  let bg = "bg-white border border-orange-300 hover:bg-orange-50 dark:border-orange-400/60";
  let text = "text-orange-600 dark:text-orange-300";
  let Icon: any = Award;

  if (normLower.includes("plus")) {
    // Gradiente en naranjas (Plus)
    bg = "bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600";
    text = "text-white";
    Icon = Crown;
  } else if (normLower.includes("deluxe")) {
    // Gradiente estilo diamante con animación
    bg = "bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 animate-gradient-x";
    text = "text-white";
    Icon = Gem;
  }

  return (
    <Badge className={`${bg} ${text} ${className || ""}`.trim()}>
      <Icon className="h-3.5 w-3.5 mr-1" />
      {`Usuario ${stripped}`}
    </Badge>
  );
}
