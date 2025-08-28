"use client";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Turnstile from "@/components/security/turnstile";
import { toast } from "sonner";

export type BuyerChatWindowProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sellerPlanCode?: string | null;
  sellerId: string;
  sellerName?: string | null;
  productTitle?: string | null;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  currentUserPhone?: string | null;
  onSubmitted?: (payload: {
    nombre: string;
    email: string;
    telefono: string;
    asunto: string;
    mensaje: string;
    sellerId: string;
  }) => void;
};

function planTier(plan?: string | null): "basic" | "plus" | "premium" | "deluxe" {
  const c = String(plan || "").toLowerCase();
  if (c.includes("deluxe") || c.includes("diamond")) return "deluxe";
  if (c.includes("plus") || c === "enterprise") return "plus";
  if (c === "premium" || c === "pro") return "premium";
  return "basic";
}

function isAllowedPlan(plan?: string | null) {
  const tier = planTier(plan);
  return tier === "plus" || tier === "deluxe";
}

export default function BuyerChatWindow({
  open,
  onOpenChange,
  sellerPlanCode,
  sellerId,
  sellerName,
  productTitle,
  currentUserName,
  currentUserEmail,
  currentUserPhone,
  onSubmitted,
}: BuyerChatWindowProps) {
  const allowed = isAllowedPlan(sellerPlanCode);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ nombre?: string; email?: string; telefono?: string; asunto?: string; mensaje?: string; captcha?: string }>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const defaultAsunto = productTitle ? `Consulta por: ${productTitle}` : sellerName ? `Consulta a ${sellerName}` : "Consulta";

  const [values, setValues] = useState({
    nombre: String(currentUserName || ""),
    email: String(currentUserEmail || ""),
    telefono: String(currentUserPhone || ""),
    asunto: defaultAsunto,
    mensaje: "",
  });

  const validate = (vals: typeof values) => {
    const errs: typeof errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = vals.telefono.replace(/[^\d]/g, "");
    if (!vals.nombre || vals.nombre.trim().length < 2) errs.nombre = "Ingresa tu nombre (mín. 2).";
    if (!vals.email || !emailRegex.test(vals.email)) errs.email = "Ingresa un email válido.";
    if (phoneDigits.length < 8) errs.telefono = "Ingresa un teléfono válido.";
    if (!vals.asunto || vals.asunto.trim().length < 3) errs.asunto = "Ingresa un asunto (mín. 3).";
    if (!vals.mensaje || vals.mensaje.trim().length < 1) errs.mensaje = "El mensaje debe tener al menos 1 carácter.";
    if (turnstileEnabled && !captchaToken) errs.captcha = "Completa el CAPTCHA.";
    return { valid: Object.keys(errs).length === 0, errs };
  };

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault?.();
    const { valid, errs } = validate(values);
    if (!valid) {
      setErrors(errs);
      return;
    }
    if (!allowed) {
      toast.error("Funcionalidad disponible solo para planes Plus y Deluxe.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/messages/contact-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, sellerId, captchaToken: captchaToken || "" }),
      });
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j?.error || "";
        } catch {}
        throw new Error(detail || `HTTP_${res.status}`);
      }
      toast.success("Mensaje enviado correctamente");
      onSubmitted?.({ ...values, sellerId });
      onOpenChange(false);
      setCaptchaToken(null);
      // Reset solo del mensaje
      setValues((prev) => ({ ...prev, mensaje: "" }));
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "";
      toast.error(msg ? `No se pudo enviar: ${msg}` : "No se pudo enviar el mensaje. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[96vw] max-w-lg flex-col p-0 overflow-hidden">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Contactar vendedor</DialogTitle>
          <DialogDescription className="truncate">
            {sellerName ? `Inicia una conversación con ${sellerName}` : "Inicia una conversación"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0">
          <form onSubmit={handleSend} className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={values.nombre}
                onChange={(e) => setValues((v) => ({ ...v, nombre: e.target.value }))}
                placeholder="Tu nombre"
                aria-invalid={Boolean(errors.nombre)}
              />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Mail *</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                placeholder="tu@email.com"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input
                id="telefono"
                value={values.telefono}
                onChange={(e) => setValues((v) => ({ ...v, telefono: e.target.value }))}
                placeholder="Código de área y número"
                aria-invalid={Boolean(errors.telefono)}
              />
              {errors.telefono && <p className="text-sm text-destructive">{errors.telefono}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asunto">Asunto *</Label>
              <Input
                id="asunto"
                value={values.asunto}
                onChange={(e) => setValues((v) => ({ ...v, asunto: e.target.value }))}
                placeholder="Motivo del contacto"
                aria-invalid={Boolean(errors.asunto)}
              />
              {errors.asunto && <p className="text-sm text-destructive">{errors.asunto}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mensaje">Mensaje *</Label>
              <Textarea
                id="mensaje"
                rows={6}
                value={values.mensaje}
                onChange={(e) => setValues((v) => ({ ...v, mensaje: e.target.value }))}
                placeholder="Escribe tu mensaje"
                aria-invalid={Boolean(errors.mensaje)}
              />
              {errors.mensaje && <p className="text-sm text-destructive">{errors.mensaje}</p>}
            </div>
            {turnstileEnabled && (
              <div className="grid gap-2">
                <Label>Verificación</Label>
                <Turnstile onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
                {errors.captcha && <p className="text-sm text-destructive">{errors.captcha}</p>}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
