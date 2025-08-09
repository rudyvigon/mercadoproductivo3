"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ nombre?: string; email?: string; asunto?: string; mensaje?: string }>({});

  function validate(values: { nombre: string; email: string; asunto: string; mensaje: string }) {
    const errs: typeof errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!values.nombre || values.nombre.trim().length < 2) errs.nombre = "Ingresa tu nombre (mín. 2 caracteres).";
    if (!values.email || !emailRegex.test(values.email)) errs.email = "Ingresa un email válido.";
    if (!values.asunto || values.asunto.trim().length < 3) errs.asunto = "Ingresa un asunto (mín. 3 caracteres).";
    if (!values.mensaje || values.mensaje.trim().length < 10) errs.mensaje = "El mensaje debe tener al menos 10 caracteres.";
    return { valid: Object.keys(errs).length === 0, errs };
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name } = e.currentTarget;
    // Limpiar error del campo cuando el usuario empieza a corregir
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.currentTarget;
    const { errs } = validate({
      nombre: name === "nombre" ? value : (e.currentTarget.form?.nombre?.value || ""),
      email: name === "email" ? value : (e.currentTarget.form?.email?.value || ""),
      asunto: name === "asunto" ? value : (e.currentTarget.form?.asunto?.value || ""),
      mensaje: name === "mensaje" ? value : (e.currentTarget.form?.mensaje?.value || ""),
    } as any);
    setErrors((prev) => ({ ...prev, [name]: (errs as any)[name] }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);

    const nombre = String(data.get("nombre") || "").trim();
    const email = String(data.get("email") || "").trim();
    const asunto = String(data.get("asunto") || "").trim();
    const mensaje = String(data.get("mensaje") || "").trim();

    const { valid, errs } = validate({ nombre, email, asunto, mensaje });
    if (!valid) {
      setErrors(errs);
      return;
    }

    try {
      setLoading(true);
      // TODO: integrar con una API real (por ejemplo POST /api/contact)
      await new Promise((r) => setTimeout(r, 800));
      toast.success("¡Mensaje enviado! Te responderemos a la brevedad.");
      form.reset();
      setErrors({});
    } catch (e) {
      toast.error("No se pudo enviar el mensaje. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate onInvalid={(e) => e.preventDefault()} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="nombre">Nombre Completo *</Label>
        <Input
          id="nombre"
          name="nombre"
          placeholder="Tu nombre"
          required
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(errors.nombre)}
          aria-describedby={errors.nombre ? "nombre-error" : undefined}
        />
        {errors.nombre && (
          <p id="nombre-error" className="text-sm text-destructive">{errors.nombre}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="asunto">Asunto *</Label>
        <Input
          id="asunto"
          name="asunto"
          placeholder="¿Sobre qué quieres hablar?"
          required
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(errors.asunto)}
          aria-describedby={errors.asunto ? "asunto-error" : undefined}
        />
        {errors.asunto && (
          <p id="asunto-error" className="text-sm text-destructive">{errors.asunto}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mensaje">Mensaje *</Label>
        <Textarea
          id="mensaje"
          name="mensaje"
          rows={6}
          placeholder="Cuéntanos en detalle"
          required
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(errors.mensaje)}
          aria-describedby={errors.mensaje ? "mensaje-error" : undefined}
        />
        {errors.mensaje && (
          <p id="mensaje-error" className="text-sm text-destructive">{errors.mensaje}</p>
        )}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar Mensaje"}
      </Button>
    </form>
  );
}
