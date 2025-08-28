"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AuthGateModal({
  open,
  onOpenChange,
  title = "Crear una cuenta",
  description = "Necesitas una cuenta para usar el chat.",
  registerHref = "/auth/register",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  registerHref?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button asChild>
            <Link href={registerHref}>Crear cuenta</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
