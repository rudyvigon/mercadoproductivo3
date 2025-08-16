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
}

export function GuardedCreateButton({ href, missingLabels, className, children, ...props }: GuardedCreateButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (missingLabels.length === 0) {
      router.push(href);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button className={cn(className)} onClick={onClick} {...props}>
        {children}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
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
                // Redirigir a la página de perfil (alias en español) con parámetro `next` para volver al flujo original
                const next = encodeURIComponent(href);
                router.push(`/dashboard/perfil?next=${next}`);
              }}
            >
              Completar tu información
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
