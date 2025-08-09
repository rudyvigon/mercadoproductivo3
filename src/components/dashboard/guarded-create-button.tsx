"use client";
import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();

  const scrollToCard = useCallback(() => {
    const doScroll = () => {
      const el = document.getElementById("profile-requirements-card");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-orange-500");
        setTimeout(() => el.classList.remove("ring-2", "ring-orange-500"), 1500);
      }
    };
    if (pathname !== "/dashboard") {
      router.push("/dashboard");
      setTimeout(doScroll, 400);
    } else {
      doScroll();
    }
  }, [pathname, router]);

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
                scrollToCard();
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
