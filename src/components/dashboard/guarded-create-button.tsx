"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface GuardedCreateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href: string;
  missingLabels: string[];
  // Nuevo: bloqueo por límite de productos del plan
  limitReached?: boolean;
  maxProducts?: number | null;
  currentCount?: number;
}

export function GuardedCreateButton({ href, missingLabels, limitReached = false, maxProducts = null, currentCount = 0, className, children, ...props }: GuardedCreateButtonProps) {
  const [open, setOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"profile" | "limit" | null>(null);
  const router = useRouter();

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // Prioridad 1: Perfil incompleto
    if (missingLabels.length > 0) {
      setDialogType("profile");
      setOpen(true);
      return;
    }
    // Prioridad 2: Límite de productos alcanzado
    if (limitReached) {
      setDialogType("limit");
      setOpen(true);
      return;
    }
    // Caso OK: continuar
    router.push(href);
  };

  return (
    <>
      <button className={cn(className)} onClick={onClick} {...props}>
        {children}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          {dialogType === "profile" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Información incompleta</AlertDialogTitle>
                <AlertDialogDescription>
                  Para publicar productos, primero completa los siguientes datos del perfil:
                  <ul className="mt-3 list-disc pl-5">
                    {missingLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setOpen(false);
                    const next = encodeURIComponent(href);
                    router.push(`/dashboard/perfil?next=${next}`);
                  }}
                >
                  Completar tu información
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Límite de productos alcanzado</AlertDialogTitle>
                <AlertDialogDescription>
                  Ya tienes {currentCount} producto(s) y tu plan permite un máximo de {maxProducts ?? "—"}.
                  Para publicar más, actualiza tu plan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setOpen(false);
                    router.push("/planes");
                  }}
                >
                  Ver planes
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

