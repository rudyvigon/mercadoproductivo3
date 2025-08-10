"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { toSpanishErrorMessage } from "@/lib/i18n/errors";

function isValidDniCuit(raw: string): boolean {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 8) {
    // DNI 7 u 8 dígitos
    return /^\d{7,8}$/.test(digits);
  }

  if (digits.length === 11) {
    // CUIT 11 dígitos con dígito verificador
    if (!/^\d{11}$/.test(digits)) return false;
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const nums = digits.split("").map((n) => parseInt(n, 10));
    const sum = weights.reduce((acc, w, i) => acc + w * nums[i], 0);
    const mod = sum % 11;
    let check = 11 - mod;
    if (check === 11) check = 0;
    if (check === 10) check = 9;
    return check === nums[10];
  }
  return false;
}

const profileSchema = z.object({
  first_name: z.string().min(1, "Requerido"),
  last_name: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  dni_cuit: z
    .string()
    .min(1, "Requerido")
    .refine((v) => isValidDniCuit(v), {
      message: "Ingrese DNI (7-8 dígitos) o CUIT válido (11 dígitos).",
    }),
  company: z.string().optional().or(z.literal("")),
  address: z.string().min(1, "Requerido"),
  city: z.string().min(1, "Requerido"),
  province: z.string().min(1, "Requerido"),
  cp: z.string().min(1, "Requerido"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

type ProfileFormProps = {
  disabled?: boolean;
  hideInternalSubmit?: boolean;
  registerSubmit?: (submit: () => void) => void;
  onSaved?: () => void;
};

export default function ProfileForm({ disabled = false, hideInternalSubmit = false, registerSubmit, onSaved }: ProfileFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      dni_cuit: "",
      company: "",
      address: "",
      city: "",
      province: "",
      cp: "",
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

  // Provincias de Argentina
  const provinces = useMemo(
    () => [
      "Buenos Aires",
      "Ciudad Autónoma de Buenos Aires",
      "Catamarca",
      "Chaco",
      "Chubut",
      "Córdoba",
      "Corrientes",
      "Entre Ríos",
      "Formosa",
      "Jujuy",
      "La Pampa",
      "La Rioja",
      "Mendoza",
      "Misiones",
      "Neuquén",
      "Río Negro",
      "Salta",
      "San Juan",
      "San Luis",
      "Santa Cruz",
      "Santa Fe",
      "Santiago del Estero",
      "Tierra del Fuego",
      "Tucumán",
    ],
    []
  );

  const [localities, setLocalities] = useState<string[]>([]);
  const [loadingLocalities, setLoadingLocalities] = useState(false);

  // Cargar localidades cuando cambia provincia
  useEffect(() => {
    const subscription = form.watch(async (value, { name }) => {
      if (name === "province") {
        const prov = value.province as string;
        // Reiniciar ciudad
        form.setValue("city", "");
        setLocalities([]);
        if (!prov) return;
        try {
          setLoadingLocalities(true);
          const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(
            prov
          )}&max=500`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Error al cargar localidades");
          const data = await res.json();
          const items: string[] = (data?.localidades || []).map((l: any) => l?.nombre).filter(Boolean).sort();
          setLocalities(items);
        } catch (e) {
          console.warn("Fallo carga de localidades", e);
          setLocalities([]);
        } finally {
          setLoadingLocalities(false);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Si ya hay provincia cargada (por datos existentes), cargar localidades al montar
  useEffect(() => {
    const prov = form.getValues("province");
    if (!prov || localities.length > 0) return;
    (async () => {
      try {
        setLoadingLocalities(true);
        const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(
          prov
        )}&max=500`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Error al cargar localidades");
        const data = await res.json();
        const items: string[] = (data?.localidades || []).map((l: any) => l?.nombre).filter(Boolean).sort();
        setLocalities(items);
      } catch (e) {
        console.warn("Fallo carga de localidades (init)", e);
      } finally {
        setLoadingLocalities(false);
      }
    })();
  }, [form, localities.length]);

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
        .select("first_name, last_name, dni_cuit, company, address, city, province, postal_code")
        .eq("id", user.id)
        .single();
      if (!mounted) return;
      if (error && error.code !== "PGRST116") {
        console.error(error);
        toast.error("No se pudo cargar el perfil");
      }
      form.reset({
        first_name: data?.first_name ?? (user.user_metadata?.first_name ?? ""),
        last_name: data?.last_name ?? (user.user_metadata?.last_name ?? ""),
        email: user.email ?? "",
        dni_cuit: data?.dni_cuit ?? "",
        company: data?.company ?? "",
        address: data?.address ?? "",
        city: data?.city ?? "",
        province: data?.province ?? "",
        cp: data?.postal_code ?? "",
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [form, supabase]);

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const full_name = `${values.first_name} ${values.last_name}`.trim();
      const dniCuitSanitized = (values.dni_cuit || "").replace(/\D/g, "");
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        full_name,
        dni_cuit: dniCuitSanitized,
        company: values.company ?? "",
        address: values.address,
        city: values.city,
        province: values.province,
        postal_code: values.cp,
        updated_at: new Date().toISOString(),
      } as const;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...payload }, { onConflict: "id" });
      if (error) throw error;
      toast.success("Perfil actualizado");
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(toSpanishErrorMessage(e, "No se pudo actualizar el perfil"));
    } finally {
      setSaving(false);
    }
  }

  // Exponer submit externo si se solicita
  useEffect(() => {
    if (!registerSubmit) return;
    const submit = () => form.handleSubmit(onSubmit)();
    registerSubmit(submit);
  }, [form, registerSubmit, onSubmit]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Cargando perfil...</div>;
  }

  const allDisabled = disabled || saving;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="first_name"
            className={form.getFieldState("first_name", form.formState).error ? "text-red-600" : undefined}
          >
            Nombre <span className="text-red-600">*</span>
          </Label>
          <Input
            id="first_name"
            {...form.register("first_name")}
            {...fieldAttrs("first_name")}
            aria-describedby="first_name-error"
            disabled={allDisabled}
            className={form.getFieldState("first_name", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
          />
          {form.getFieldState("first_name", form.formState).error && (
            <p id="first_name-error" className="text-xs text-red-600">
              {form.getFieldState("first_name", form.formState).error?.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="last_name"
            className={form.getFieldState("last_name", form.formState).error ? "text-red-600" : undefined}
          >
            Apellido <span className="text-red-600">*</span>
          </Label>
          <Input
            id="last_name"
            {...form.register("last_name")}
            {...fieldAttrs("last_name")}
            aria-describedby="last_name-error"
            disabled={allDisabled}
            className={form.getFieldState("last_name", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
          />
          {form.getFieldState("last_name", form.formState).error && (
            <p id="last_name-error" className="text-xs text-red-600">
              {form.getFieldState("last_name", form.formState).error?.message}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className={form.getFieldState("email", form.formState).error ? "text-red-600" : undefined}
        >
          Email <span className="text-red-600">*</span>
        </Label>
        <Input
          id="email"
          {...form.register("email")}
          readOnly
          disabled
          aria-describedby="email-error"
          className={form.getFieldState("email", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
        />
        {form.getFieldState("email", form.formState).error && (
          <p id="email-error" className="text-xs text-red-600">
            {form.getFieldState("email", form.formState).error?.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="dni_cuit"
            className={form.getFieldState("dni_cuit", form.formState).error ? "text-red-600" : undefined}
          >
            DNI o CUIT <span className="text-red-600">*</span>
          </Label>
          <Input
            id="dni_cuit"
            {...form.register("dni_cuit")}
            {...fieldAttrs("dni_cuit")}
            aria-describedby="dni_cuit-error"
            disabled={allDisabled}
            className={form.getFieldState("dni_cuit", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
          />
          {form.getFieldState("dni_cuit", form.formState).error && (
            <p id="dni_cuit-error" className="text-xs text-red-600">
              {form.getFieldState("dni_cuit", form.formState).error?.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Empresa (opcional)</Label>
          <Input id="company" {...form.register("company")} {...fieldAttrs("company")} disabled={allDisabled} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-1">
          <Label className={form.getFieldState("province", form.formState).error ? "text-red-600" : undefined}>
            Provincia <span className="text-red-600">*</span>
          </Label>
          <Controller
            name="province"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                <SelectTrigger
                  aria-invalid={form.getFieldState("province", form.formState).error ? true : undefined}
                  aria-describedby="province-error"
                  disabled={allDisabled}
                  className={form.getFieldState("province", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
                >
                  <SelectValue placeholder="Selecciona provincia" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.getFieldState("province", form.formState).error && (
            <p id="province-error" className="text-xs text-red-600">
              {form.getFieldState("province", form.formState).error?.message}
            </p>
          )}
        </div>
        <div className="space-y-2 lg:col-span-1">
          <Label className={form.getFieldState("city", form.formState).error ? "text-red-600" : undefined}>
            Localidad <span className="text-red-600">*</span>
          </Label>
          <Controller
            name="city"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={allDisabled || !form.getValues("province") || loadingLocalities || localities.length === 0}
              >
                <SelectTrigger
                  aria-invalid={form.getFieldState("city", form.formState).error ? true : undefined}
                  aria-describedby="city-error"
                  disabled={allDisabled}
                  className={form.getFieldState("city", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
                >
                  <SelectValue placeholder={
                    !form.getValues("province")
                      ? "Selecciona provincia primero"
                      : loadingLocalities
                        ? "Cargando..."
                        : localities.length === 0
                          ? "Sin datos"
                          : "Selecciona localidad"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {localities.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.getFieldState("city", form.formState).error && (
            <p id="city-error" className="text-xs text-red-600">
              {form.getFieldState("city", form.formState).error?.message}
            </p>
          )}
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label
            htmlFor="address"
            className={form.getFieldState("address", form.formState).error ? "text-red-600" : undefined}
          >
            Dirección <span className="text-red-600">*</span>
          </Label>
          <Input
            id="address"
            {...form.register("address")}
            {...fieldAttrs("address")}
            placeholder="Calle y número"
            aria-describedby="address-error"
            disabled={allDisabled}
            className={form.getFieldState("address", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
          />
          {form.getFieldState("address", form.formState).error && (
            <p id="address-error" className="text-xs text-red-600">
              {form.getFieldState("address", form.formState).error?.message}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="cp"
            className={form.getFieldState("cp", form.formState).error ? "text-red-600" : undefined}
          >
            CP <span className="text-red-600">*</span>
          </Label>
          <Input
            id="cp"
            {...form.register("cp")}
            {...fieldAttrs("cp")}
            placeholder="Código Postal"
            aria-describedby="cp-error"
            disabled={allDisabled}
            className={form.getFieldState("cp", form.formState).error ? "border-red-500 focus-visible:ring-red-500" : undefined}
          />
          {form.getFieldState("cp", form.formState).error && (
            <p id="cp-error" className="text-xs text-red-600">
              {form.getFieldState("cp", form.formState).error?.message}
            </p>
          )}
        </div>
      </div>
      {!hideInternalSubmit && (
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      )}
    </form>
  );
}
