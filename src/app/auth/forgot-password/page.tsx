"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import AuthCard from "@/components/auth/auth-card";
import { emailSchema } from "@/schemas/auth";
import { toSpanishErrorMessage } from "@/lib/i18n/errors";

export default function Page() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setLoading(true);
    try {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
        setEmailTouched(true);
        setEmailError(parsed.error.issues[0]?.message || "Correo inválido");
        setLoading(false);
        return;
      }
      const redirectTo = typeof window !== "undefined" ? `${location.origin}/auth/update-password` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success("Te enviamos un correo para restablecer tu contraseña");
    } catch (e: any) {
      toast.error(toSpanishErrorMessage(e, "No se pudo enviar el correo"));
    } finally {
      setLoading(false);
    }
  }

  function fieldAttrs() {
    const invalid = (emailTouched || submitted) && Boolean(emailError);
    const success = !invalid && (emailTouched || submitted) && email.trim().length > 0;
    return {
      "aria-invalid": invalid || undefined,
      "data-success": success || undefined,
    } as any;
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle="Ingresa tu correo para enviarte un enlace de restablecimiento."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              const next = e.target.value;
              setEmail(next);
              const res = emailSchema.safeParse(next);
              setEmailError(res.success ? null : (res.error.issues[0]?.message || "Correo inválido"));
            }}
            onBlur={() => setEmailTouched(true)}
            placeholder="nombre@ejemplo.com"
            {...fieldAttrs()}
          />
          {(emailTouched || submitted) && emailError && (
            <p className="text-sm text-destructive">{emailError}</p>
          )}
        </div>
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Enviando..." : "Enviar enlace"}</Button>
      </form>
    </AuthCard>
  );
}
