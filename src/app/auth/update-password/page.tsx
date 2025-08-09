"use client";
import AuthCard from "@/components/auth/auth-card";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { strongPasswordSchema } from "@/schemas/auth";
import { toSpanishErrorMessage } from "@/lib/i18n/errors";

export default function Page() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pwdTouched, setPwdTouched] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    // Esta página se abre desde el enlace del correo de Supabase y ya viene con sesión temporal
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setLoading(true);
    try {
      const parsed = strongPasswordSchema.safeParse(password);
      if (!parsed.success) {
        setPwdTouched(true);
        setPwdError(parsed.error.issues[0]?.message || "Contraseña inválida");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      window.location.replace("/auth/login");
    } catch (e: any) {
      toast.error(toSpanishErrorMessage(e, "No se pudo actualizar la contraseña"));
    } finally {
      setLoading(false);
    }
  }

  function fieldAttrs() {
    const invalid = (pwdTouched || submitted) && Boolean(pwdError);
    const success = !invalid && (pwdTouched || submitted) && password.trim().length > 0;
    return {
      "aria-invalid": invalid || undefined,
      "data-success": success || undefined,
    } as any;
  }

  return (
    <AuthCard
      title="Definir nueva contraseña"
      subtitle="Ingresa tu nueva contraseña para tu cuenta."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => {
              const next = e.target.value;
              setPassword(next);
              const res = strongPasswordSchema.safeParse(next);
              setPwdError(res.success ? null : (res.error.issues[0]?.message || "Contraseña inválida"));
            }}
            onBlur={() => setPwdTouched(true)}
            {...fieldAttrs()}
          />
          {(pwdTouched || submitted) && pwdError && (
            <p className="text-sm text-destructive">{pwdError}</p>
          )}
        </div>
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Guardando..." : "Guardar"}</Button>
      </form>
    </AuthCard>
  );
}
