"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { buildSafeStoragePath } from "@/lib/images";
import { Switch } from "@/components/ui/switch";

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
  // Campo Deluxe
  exportador: z.boolean().optional().default(false),
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
  const [savingExportador, setSavingExportador] = useState(false);
  const [loading, setLoading] = useState(true);
  const existingPlanCodeRef = useRef<string | null>(null);
  const exportadorColumnExistsRef = useRef<boolean>(true);
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
      exportador: false,
    },
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const AVATAR_BUCKET = "avatars";
  const AVATAR_MAX_MB = 5;

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

  // Utilidades: normalizar nombres para igualar contra opciones (quita acentos y pasa a minúsculas)
  const normalize = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const provinceCanonical = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of provinces) {
      map.set(normalize(p), p);
    }
    return (raw: string) => map.get(normalize(raw)) || raw;
  }, [provinces]);

  const [localities, setLocalities] = useState<string[]>([]);
  const [loadingLocalities, setLoadingLocalities] = useState(false);
  const isInitializing = useRef(true);

  // Helper para cargar localidades de una provincia
  const loadLocalities = async (prov: string, preserveCity: boolean) => {
    if (!prov) {
      setLocalities([]);
      return;
    }
    try {
      setLoadingLocalities(true);
      const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(prov)}&max=500`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar localidades");
      const data = await res.json();
      const items: string[] = (data?.localidades || []).map((l: any) => l?.nombre).filter(Boolean).sort();
      const currentCity = form.getValues("city");
      if (preserveCity && currentCity && !items.includes(currentCity)) {
        setLocalities([currentCity, ...items]);
      } else {
        setLocalities(items);
      }
    } catch (e) {
      console.warn("Fallo carga de localidades (helper)", e);
      setLocalities([]);
    } finally {
      setLoadingLocalities(false);
    }
  };

  // Cargar localidades cuando cambia provincia
  useEffect(() => {
    const subscription = form.watch(async (value, { name }) => {
      if (name === "province") {
        // Evitar borrar 'city' cuando el cambio de provincia proviene de form.reset inicial
        if (isInitializing.current) return;
        const prov = value.province as string;
        // Reiniciar ciudad
        form.setValue("city", "");
        setLocalities([]);
        await loadLocalities(prov, false);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      let data: any = null;
      let error: any = null;
      {
        const res = await supabase
          .from("profiles")
          .select("first_name, last_name, dni_cuit, company, address, city, province, postal_code, plan_code, avatar_url, exportador")
          .eq("id", user.id)
          .single();
        data = res.data; error = res.error;
      }
      // Si falla por columna inexistente, reintentar sin 'exportador'
      if (error && /exportador|column|does not exist/i.test(error?.message || "")) {
        exportadorColumnExistsRef.current = false;
        const res2 = await supabase
          .from("profiles")
          .select("first_name, last_name, dni_cuit, company, address, city, province, postal_code, plan_code, avatar_url")
          .eq("id", user.id)
          .single();
        data = res2.data; error = res2.error;
      }
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
        city: (data?.city ?? ""),
        province: provinceCanonical(data?.province ?? ""),
        cp: data?.postal_code ?? "",
        exportador: exportadorColumnExistsRef.current ? Boolean((data as any)?.exportador) || false : false,
      });
      existingPlanCodeRef.current = (data?.plan_code ?? null) as any;
      setAvatarUrl(data?.avatar_url ?? null);
      // Cargar localidades para la provincia reseteada y preservar la ciudad existente
      const provToLoad = provinceCanonical(data?.province ?? "");
      if (provToLoad) {
        await loadLocalities(provToLoad, true);
      } else {
        setLocalities([]);
      }
      setLoading(false);
      // A partir de aquí, los cambios de provincia ya son del usuario
      isInitializing.current = false;
    })();
    return () => { mounted = false; };
  }, [form, supabase]);

  async function handleAvatarSelected(file: File) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      toast.error(`La imagen supera ${AVATAR_MAX_MB}MB`);
      return;
    }
    setAvatarUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { path } = buildSafeStoragePath({ userId: user.id, file });
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl as string | undefined;
      if (!publicUrl) throw new Error("No se pudo obtener URL pública del avatar");
      const { error: dbErr } = await supabase
        .from("profiles")
        .upsert({ id: (await supabase.auth.getUser()).data.user!.id, avatar_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (dbErr) throw dbErr;
      try {
        await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      } catch {}
      setAvatarUrl(publicUrl);
      toast.success("Avatar actualizado");
      try {
        window.dispatchEvent(new CustomEvent("profile:updated", { detail: { avatar_url: publicUrl } }));
      } catch {}
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? String(e);
      if (/bucket.*not.*found/i.test(msg)) {
        toast.error("Falta el bucket 'avatars' en Supabase Storage. Crea el bucket o ajusta la configuración.");
      } else if (/row-level security|RLS|permission denied|not authorized/i.test(msg)) {
        toast.error("Permisos insuficientes para subir avatar (RLS). Revisa políticas en Supabase.");
      } else {
        toast.error(toSpanishErrorMessage(e, "No se pudo actualizar el avatar"));
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  function onAvatarInputChange(e: any) {
    const f = e?.target?.files?.[0];
    if (f) handleAvatarSelected(f);
    if (e?.target) e.target.value = "";
  }

  // Guardado inmediato del switch de Exportador (independiente del resto del formulario)
  async function saveExportadorImmediate(nextValue: boolean, prevValue?: boolean) {
    if (!exportadorColumnExistsRef.current) return;
    setSavingExportador(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const planLower = (existingPlanCodeRef.current || "").toLowerCase();
      const isDeluxe = (planLower.includes("deluxe") || planLower.includes("diamond") || planLower === "premium" || planLower === "pro");
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      // Solo persistimos exportador si el plan lo permite, caso contrario lo forzamos a false
      payload.exportador = isDeluxe ? Boolean(nextValue) : false;
      // Asegurar que el trigger tenga NEW.plan_code
      const roleRaw = (((user.user_metadata as any)?.role) || ((user.user_metadata as any)?.user_type) || "") as string;
      const roleNormalized = roleRaw === "anunciante" ? "seller" : roleRaw;
      if (existingPlanCodeRef.current) {
        payload.plan_code = existingPlanCodeRef.current;
      } else if (roleNormalized === "seller") {
        payload.plan_code = "free";
      }
      try { console.debug("Perfil: toggle exportador ->", { nextValue, plan_code: (existingPlanCodeRef.current || null), isDeluxe }); } catch {}
      const { data: saved, error } = await supabase
        .from("profiles")
        .update({ exportador: payload.exportador, updated_at: payload.updated_at })
        .eq("id", user.id)
        .select("exportador, plan_code")
        .single();
      if (error) throw error;
      try { console.debug("Perfil: toggle exportador guardado OK", saved); } catch {}
      if (typeof saved?.exportador === "boolean") {
        // Sincronizar por si el trigger lo ajustó
        form.setValue("exportador", saved.exportador, { shouldDirty: false, shouldTouch: false });
      }
    } catch (e: any) {
      console.error("Perfil: error al guardar toggle exportador", e);
      const hint = e?.hint || e?.details || (e?.error_description ?? e?.message);
      const msg = toSpanishErrorMessage(e, hint || "No se pudo actualizar la preferencia de exportador");
      toast.error(msg);
      // Revertir UI (volvemos al valor actual en formulario)
      const fallback = typeof prevValue === "boolean" ? prevValue : !nextValue;
      form.setValue("exportador", Boolean(fallback), { shouldDirty: false, shouldTouch: false });
    } finally {
      setSavingExportador(false);
    }
  }

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const full_name = `${values.first_name} ${values.last_name}`.trim();
      const dniCuitSanitized = (values.dni_cuit || "").replace(/\D/g, "");
      const payload: any = {
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
      };
      // Persistir exportador sólo si el plan es Deluxe (o sinónimos/variantes)
      const planLower = (existingPlanCodeRef.current || "").toLowerCase();
      const isDeluxe = hasExportadorCapability(planLower);
      if (exportadorColumnExistsRef.current) {
        payload.exportador = isDeluxe ? Boolean(values.exportador) : false;
      }
      // Debug útil para diagnosticar por qué no se aplica el cambio
      try { console.debug("Perfil: guardando", { exportador: payload.exportador, plan_code: planLower, isDeluxe }); } catch {}
      // Incluir siempre plan_code en el payload para que el trigger tenga el valor en NEW.plan_code
      const roleRaw = (((user.user_metadata as any)?.role) || ((user.user_metadata as any)?.user_type) || "") as string;
      const roleNormalized = roleRaw === "anunciante" ? "seller" : roleRaw;
      if (existingPlanCodeRef.current) {
        payload.plan_code = existingPlanCodeRef.current;
      } else if (roleNormalized === "seller") {
        // Si es vendedor y aún no tiene plan_code, asignar 'free' por defecto
        payload.plan_code = "free";
      }
      const { data: saved, error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...payload }, { onConflict: "id" })
        .select("exportador, plan_code")
        .single();
      if (error) throw error;
      try { console.debug("Perfil: guardado OK", saved); } catch {}
      // Sincronizar el valor por si el trigger lo ajustó
      if (exportadorColumnExistsRef.current && typeof saved?.exportador === "boolean") {
        form.setValue("exportador", saved.exportador, { shouldDirty: false, shouldTouch: false });
      }
      // Actualizar metadata de auth para reflejar el nombre en listeners de auth
      try {
        await supabase.auth.updateUser({
          data: {
            full_name,
            first_name: values.first_name,
            last_name: values.last_name,
          },
        });
      } catch {}
      toast.success("Perfil actualizado");
      try {
        // Notificar en tiempo real al header sin depender de Realtime
        window.dispatchEvent(
          new CustomEvent("profile:updated", { detail: payload as any })
        );
      } catch {}
      onSaved?.();
    } catch (e: any) {
      console.error("Perfil: error al guardar", e);
      const hint = e?.hint || e?.details || (e?.error_description ?? e?.message);
      const msg = toSpanishErrorMessage(e, hint || "No se pudo actualizar el perfil");
      toast.error(msg);
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
    return (
      <div className="space-y-5" aria-busy>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const allDisabled = disabled || saving;
  const planCodeLower = (existingPlanCodeRef.current || "").toLowerCase();
  const hasExportadorCapability = (code: string) => {
    const c = (code || "").toLowerCase();
    // Soporta variantes como 'deluxe_monthly'/'deluxe_yearly' y sinónimos como 'diamond'.
    if (!c) return false;
    if (c.includes("deluxe") || c.includes("diamond")) return true;
    // Compatibilidad histórica: permitir premium/pro si así se configuró el backend
    return c === "premium" || c === "pro";
  };
  const canToggleExportador = exportadorColumnExistsRef.current && hasExportadorCapability(planCodeLower);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted sm:h-20 sm:w-20">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Sin avatar</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            disabled={allDisabled || avatarUploading}
            onClick={() => avatarInputRef.current?.click()}
            className="w-fit"
          >
            {avatarUploading ? "Subiendo..." : "Cambiar avatar"}
          </Button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onAvatarInputChange}
            disabled={allDisabled || avatarUploading}
          />
          <p className="text-xs text-muted-foreground">Formatos soportados: JPG, PNG, WEBP. Máx {AVATAR_MAX_MB}MB.</p>
        </div>
      </div>
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
            DNI o CUIT (Empresa) <span className="text-red-600">*</span>
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
          <Label htmlFor="company">Empresa (Se mostrará en los productos y perfil)</Label>
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
            Código Postal <span className="text-red-600">*</span>
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

      {/* Switch Exportador (sólo visible para plan con capacidad: deluxe/diamond/premium/pro) */}
      {canToggleExportador && (
        <div className="rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50/60 to-transparent p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 inline-flex items-center gap-2">
                <Label className="text-sm font-medium">¿Mostrarse como Exportador?</Label>
                <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                  Beneficio Deluxe
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Activa esta opción para aparecer en el listado público de exportadores visibles para compradores.
              </p>
            </div>
            <Controller
              name="exportador"
              control={form.control}
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={(v) => { const prev = Boolean(field.value); field.onChange(v); void saveExportadorImmediate(v, prev); }}
                  disabled={saving || savingExportador}
                  aria-invalid={undefined}
                />
              )}
            />
          </div>
        </div>
      )}
      {!hideInternalSubmit && (
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      )}
    </form>
  );
}
