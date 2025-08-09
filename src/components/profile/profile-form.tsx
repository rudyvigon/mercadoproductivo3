"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { toSpanishErrorMessage } from "@/lib/i18n/errors";

const profileSchema = z.object({
  full_name: z.string().min(1, "Requerido"),
  first_name: z.string().optional().or(z.literal("")),
  last_name: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileForm() {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      full_name: "",
      first_name: "",
      last_name: "",
      country: "",
      phone: "",
    },
  });

  function fieldAttrs<K extends keyof ProfileFormValues>(name: K) {
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name, country, phone")
        .eq("id", user.id)
        .single();
      if (!mounted) return;
      if (error && error.code !== "PGRST116") {
        console.error(error);
        toast.error("No se pudo cargar el perfil");
      }
      form.reset({
        full_name: data?.full_name ?? (user.user_metadata?.full_name ?? ""),
        first_name: data?.first_name ?? (user.user_metadata?.first_name ?? ""),
        last_name: data?.last_name ?? (user.user_metadata?.last_name ?? ""),
        country: data?.country ?? (user.user_metadata?.country ?? ""),
        phone: data?.phone ?? (user.user_metadata?.phone ?? ""),
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const payload = { ...values, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...payload }, { onConflict: "id" });
      if (error) throw error;
      toast.success("Perfil actualizado");
    } catch (e: any) {
      console.error(e);
      toast.error(toSpanishErrorMessage(e, "No se pudo actualizar el perfil"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Cargando perfil...</div>;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input id="full_name" {...form.register("full_name")} {...fieldAttrs("full_name")} placeholder="Tu nombre" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">Nombre</Label>
          <Input id="first_name" {...form.register("first_name")} {...fieldAttrs("first_name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Apellido</Label>
          <Input id="last_name" {...form.register("last_name")} {...fieldAttrs("last_name")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">País</Label>
          <Input id="country" {...form.register("country")} {...fieldAttrs("country")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" {...form.register("phone")} {...fieldAttrs("phone")} />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
