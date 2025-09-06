"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Provincias (reutilizamos de productos)
const AR_PROVINCES = [
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
  "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
  "Tucumán",
];

const numberFromInput = z.union([z.string(), z.number()]).transform((val) => {
  const str = typeof val === "number" ? String(val) : (val || "");
  const normalized = str.toString().replace(/[^0-9.,-]/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
});

const serviceSchema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres").max(50, "Máximo 50 caracteres"),
  description: z.string().min(20, "Mínimo 20 caracteres").max(500, "Máximo 500 caracteres"),
  category: z.string().min(1, "Selecciona o ingresa una categoría"),
  price: z
    .union([numberFromInput, z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), { message: "Precio inválido" })
    .nullable(),
  province: z.string().min(1, "Selecciona una provincia"),
  city: z.string().min(1, "Selecciona una localidad"),
});

export type ServiceFormValues = z.input<typeof serviceSchema>;

export default function ServiceForm({ missingLabels = [] as string[] }: { missingLabels?: string[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [profileOk, setProfileOk] = useState<boolean>(missingLabels.length === 0);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      category: "",
      price: "" as any,
      province: "",
      city: "",
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("first_name,last_name,dni_cuit,address,city,province,postal_code")
          .eq("id", user.id)
          .single();
        const requiredMap: Record<string, string> = {
          first_name: "Nombre",
          last_name: "Apellido",
          dni_cuit: "DNI/CUIT",
          address: "Dirección",
          city: "Localidad",
          province: "Provincia",
          postal_code: "CP",
        };
        const missing: string[] = [];
        if (data) {
          Object.entries(requiredMap).forEach(([key, label]) => {
            // @ts-ignore
            if (!data[key] || String(data[key]).trim().length === 0) missing.push(label);
          });
        }
        setProfileOk(missing.length === 0);
      } catch {
        setProfileOk(missingLabels.length === 0);
      }
    })();
  }, [supabase, missingLabels]);

  // Cargar localidades al cambiar la provincia
  const selectedProvince = form.watch("province");
  useEffect(() => {
    async function loadCities(prov: string) {
      setLoadingCities(true);
      try {
        const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(prov)}&campos=nombre&orden=nombre&max=5000`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("No se pudieron cargar localidades");
        const json = await res.json();
        const list: string[] = Array.isArray(json?.localidades)
          ? json.localidades.map((l: any) => String(l.nombre))
          : [];
        setCities(list);
      } catch {
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    }
    if (selectedProvince && selectedProvince.length > 0) {
      setCities([]);
      form.setValue("city", "", { shouldValidate: true });
      loadCities(selectedProvince);
    } else {
      setCities([]);
      form.setValue("city", "", { shouldValidate: true });
    }
  }, [selectedProvince, form]);

  const showError = (name: keyof ServiceFormValues) => {
    const state = form.getFieldState(name, form.formState);
    return !!(state.error && (state.isTouched || form.formState.isSubmitted));
  };

  const fieldErrorClass = (name: keyof ServiceFormValues) => (showError(name) ? "border-red-500 focus-visible:ring-red-500" : undefined);

  async function onSubmit(raw: ServiceFormValues) {
    if (!profileOk) {
      toast.error("Completa tu perfil antes de publicar servicios");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const values = serviceSchema.parse(raw);
      const payload = {
        user_id: user.id,
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category.trim(),
        price: values.price === null ? null : values.price,
        location: `${values.city}, ${values.province}`,
        published: true,
        created_at: new Date().toISOString(),
      } as const;

      const { error } = await supabase.from("services").insert(payload as any);
      if (error) throw error;

      toast.success("Servicio publicado");
      // Redirigir a listado (si no existe, fallback al dashboard)
      try {
        router.replace("/dashboard/services");
      } catch {
        router.replace("/dashboard");
      }
      router.refresh();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (/relation\s+\"?services\"?\s+does not exist/i.test(msg)) {
        toast.error("Backend aún no disponible (tabla services). El formulario ya está listo.");
      } else if (/row-level security|RLS|permission denied|not authorized/i.test(msg)) {
        toast.error("Permisos insuficientes para crear servicio (RLS). Revisa políticas en Supabase.");
      } else {
        toast.error(`No se pudo crear el servicio: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
      {!profileOk && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
          Para publicar servicios, primero completa tu perfil (incluye tu CP). Ve al Dashboard y completa los datos requeridos.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title" className={showError("title") ? "text-red-600" : undefined}>
          Título <span className="text-red-600">*</span>
        </Label>
        <Input id="title" maxLength={50} inputMode="text" {...form.register("title")} disabled={saving} className={fieldErrorClass("title")} />
        <div className="text-xs text-muted-foreground">{(form.watch("title")?.length ?? 0)} / 50 caracteres</div>
        {showError("title") && (
          <p className="text-xs text-red-600">{form.getFieldState("title", form.formState).error?.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className={showError("description") ? "text-red-600" : undefined}>
          Descripción <span className="text-red-600">*</span>
        </Label>
        <Textarea id="description" rows={5} maxLength={500} inputMode="text" {...form.register("description")} disabled={saving} className={fieldErrorClass("description")} />
        <div className="text-[11px] text-muted-foreground">{(form.watch("description")?.length ?? 0)} / 500 caracteres</div>
        {showError("description") && (
          <p className="text-xs text-red-600">{form.getFieldState("description", form.formState).error?.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label className={showError("category") ? "text-red-600" : undefined}>Categoría <span className="text-red-600">*</span></Label>
          <Input placeholder="Ej: Logística, Consultoría, Transporte" {...form.register("category")} disabled={saving} className={fieldErrorClass("category")} />
          {showError("category") && (
            <p className="text-xs text-red-600">{form.getFieldState("category", form.formState).error?.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label className={showError("price") ? "text-red-600" : undefined}>Precio (ARS) <span className="text-muted-foreground">(opcional)</span></Label>
          <Input inputMode="decimal" placeholder="0,00" {...form.register("price")} disabled={saving} className={fieldErrorClass("price")} />
          {showError("price") && (
            <p className="text-xs text-red-600">{form.getFieldState("price", form.formState).error?.message}</p>
          )}
        </div>
      </div>

      {/* Provincia y Localidad */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className={showError("province") ? "text-red-600" : undefined}>Provincia <span className="text-red-600">*</span></Label>
          <Select value={form.watch("province") || ""} onValueChange={(v) => form.setValue("province", v, { shouldValidate: true, shouldDirty: true, shouldTouch: true })} disabled={saving}>
            <SelectTrigger className={fieldErrorClass("province")}>
              <SelectValue placeholder="Seleccione provincia" />
            </SelectTrigger>
            <SelectContent>
              {AR_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showError("province") && (
            <p className="text-xs text-red-600">{form.getFieldState("province", form.formState).error?.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className={showError("city") ? "text-red-600" : undefined}>Localidad <span className="text-red-600">*</span></Label>
          <Select value={form.watch("city") || ""} onValueChange={(v) => form.setValue("city", v, { shouldValidate: true, shouldDirty: true, shouldTouch: true })} disabled={saving || !form.watch("province") || loadingCities}>
            <SelectTrigger className={fieldErrorClass("city")}>
              <SelectValue placeholder={loadingCities ? "Cargando..." : (!form.watch("province") ? "Selecciona provincia primero" : "Selecciona localidad")} />
            </SelectTrigger>
            <SelectContent>
              {loadingCities && <SelectItem value="__loading" disabled>Cargando...</SelectItem>}
              {!loadingCities && (!cities.length ? (
                <SelectItem value="__empty" disabled>Sin localidades</SelectItem>
              ) : (
                cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))
              ))}
            </SelectContent>
          </Select>
          {showError("city") && (
            <p className="text-xs text-red-600">{form.getFieldState("city", form.formState).error?.message}</p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600">
          {saving ? "Publicando..." : "Publicar servicio"}
        </Button>
      </div>
    </form>
  );
}
