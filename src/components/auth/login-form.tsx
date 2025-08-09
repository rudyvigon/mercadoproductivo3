"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LoginInput, loginSchema } from "@/schemas/auth";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { toSpanishErrorMessage } from "@/lib/i18n/errors";
import { LogIn } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  function fieldAttrs<K extends keyof LoginInput>(name: K) {
    const state = form.getFieldState(name as any, form.formState);
    const invalid = Boolean(state.error);
    const value = form.getValues(name);
    const hasValue = typeof value === "string" ? value.trim().length > 0 : Boolean(value);
    const success = !invalid && (state.isDirty || state.isTouched || form.formState.isSubmitted) && hasValue;
    return {
      "aria-invalid": invalid || undefined,
      "data-success": success || undefined,
    } as any;
  }

  async function onSubmit(values: LoginInput) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;

      toast.success("¡Bienvenido!");
      router.replace("/dashboard");
    } catch (e: any) {
      toast.error(toSpanishErrorMessage(e, "Error al iniciar sesión"));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="nombre@ejemplo.com" {...form.register("email")} {...fieldAttrs("email")} />
        <p
          className={`min-h-[20px] text-sm ${form.formState.errors.email ? "text-red-400" : "opacity-0"}`}
          aria-live="polite"
        >
          {form.formState.errors.email?.message || " "}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} {...fieldAttrs("password")} />
        <p
          className={`min-h-[20px] text-sm ${form.formState.errors.password ? "text-red-400" : "opacity-0"}`}
          aria-live="polite"
        >
          {form.formState.errors.password?.message || " "}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="remember"
          checked={form.watch("remember")}
          onCheckedChange={(c) =>
            form.setValue("remember", c === true, {
              shouldValidate: false,
              shouldDirty: true,
              shouldTouch: true,
            })
          }
        />
        <Label htmlFor="remember" className="text-sm text-muted-foreground">Recordarme</Label>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        <LogIn size={16} /> {loading ? "Ingresando..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}
