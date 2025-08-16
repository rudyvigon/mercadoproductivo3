"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { UploadCloud, ChevronLeft, ChevronRight } from "lucide-react";
import { buildSafeStoragePath } from "@/lib/images";

// Aceptar string o number y normalizar valores numéricos con coma/punto
const numberFromInput = z.union([z.string(), z.number()]).transform((val) => {
  const str = typeof val === "number" ? String(val) : val;
  const normalized = str.toString().replace(/[^0-9.,-]/g, "").replace(",", ".");
  return Number(normalized);
});

// Provincias de Argentina (para dropdown)
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

const productSchema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres").max(20, "Máximo 20 caracteres"),
  description: z.string().min(10, "Mínimo 10 caracteres").max(250, "Máximo 250 caracteres"),
  category: z.string().min(1, "Selecciona una categoría"),
  price: numberFromInput.refine((v) => !Number.isNaN(v) && v > 0, { message: "Ingresa un precio válido" }),
  quantity_value: numberFromInput.refine((v) => !Number.isNaN(v) && v > 0, { message: "Ingresa una cantidad válida" }),
  quantity_unit: z.enum(["unidad", "kg", "tn"], { required_error: "Selecciona unidad" }),
  province: z.string().min(1, "Selecciona una provincia"),
  city: z.string().min(1, "Selecciona una localidad"),
});

export type ProductFormValues = z.input<typeof productSchema>;

type ProductFormProps = {
  missingLabels?: string[];
};

export default function ProductForm({ missingLabels = [] }: ProductFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [profileOk, setProfileOk] = useState<boolean>(missingLabels.length === 0);
  const [isDragging, setIsDragging] = useState(false);
  const [maxFiles, setMaxFiles] = useState<number>(6);
  const MAX_SIZE_MB = 5;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const isFull = files.length >= maxFiles;
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      category: "",
      price: "",
      quantity_value: "",
      quantity_unit: undefined as any,
      province: "",
      city: "",
    },
  });

  useEffect(() => {
    // doble chequeo por si el usuario entró directo a la URL
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
        // si falla, permitimos continuar y lo manejará Supabase/servidor
        setProfileOk(missingLabels.length === 0);
      }
    })();
  }, [supabase, missingLabels]);

  // Cargar localidades al cambiar la provincia seleccionada
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
      } catch (e) {
        console.error(e);
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

  // Resolver límite de imágenes por plan desde la tabla `plans` (fallback 5)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_code')
          .eq('id', user.id)
          .single();
        const planCode = (profile?.plan_code || '').toString();
        if (!planCode) {
          setMaxFiles(5);
          return;
        }
        const { data: plan } = await supabase
          .from('plans')
          .select('max_images_per_product')
          .eq('code', planCode)
          .maybeSingle();
        const maxImages = Number((plan as any)?.max_images_per_product) || 5;
        setMaxFiles(maxImages);
      } catch {
        setMaxFiles(5);
      }
    })();
  }, [supabase]);

  // Cargar categorías desde tabla `categories` (fallback a products.category)
  useEffect(() => {
    (async () => {
      setLoadingCategories(true);
      try {
        // 1) Intentar desde tabla maestra `categories`
        const { data: catData, error: catError } = await supabase
          .from("categories")
          .select("*");

        if (!catError && Array.isArray(catData)) {
          const list = Array.from(
            new Set(
              (catData as any[])
                .map((r) => (r?.name ?? r?.title ?? r?.label ?? r?.slug ?? "").toString().replace(/[-_]/g, " ").trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b));
          setCategories(list);
          return;
        }

        // 2) Fallback: deducir desde products.category si `categories` no existe o falla
        const { data, error } = await supabase
          .from("products")
          .select("category")
          .not("category", "is", null);
        if (error) throw error;
        const list = Array.from(
          new Set(
            (data || [])
              .map((r: any) => (r?.category ?? "").toString().trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        setCategories(list);
      } catch {
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [supabase]);

  function showError(name: keyof ProductFormValues) {
    const state = form.getFieldState(name, form.formState);
    return !!(state.error && (state.isTouched || form.formState.isSubmitted));
  }

  function fieldErrorClass(name: keyof ProductFormValues) {
    return showError(name)
      ? "border-red-500 focus-visible:ring-red-500"
      : undefined;
  }

  function appendFiles(newFiles: FileList | File[]) {
    if (saving || isFull) return;
    const all = Array.from(newFiles);
    const images = all.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const tooBig = images.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (tooBig.length) {
      toast.error(`Algunas imágenes superan ${MAX_SIZE_MB}MB y fueron omitidas`);
    }
    const accepted = images.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    setFiles((prev) => {
      const remainingSlots = Math.max(0, maxFiles - prev.length);
      const next = [...prev, ...accepted.slice(0, remainingSlots)];
      if (accepted.length > remainingSlots) {
        toast.error(`Máximo ${maxFiles} imágenes por producto`);
      }
      return next;
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (saving || isFull) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (saving || isFull) return;
    if (e.dataTransfer?.files?.length) {
      appendFiles(e.dataTransfer.files);
    }
  }

  async function uploadImages(userId: string): Promise<string[]> {
    if (!files.length) return [];
    const bucket = "product-images";
    const urls: string[] = [];
    for (const f of files) {
      const { path } = buildSafeStoragePath({ userId, file: f });
      const { error } = await supabase.storage.from(bucket).upload(path, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || undefined,
      });
      if (error) throw new Error(`Error subiendo imagen: ${error.message}`);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  }

  async function onSubmit(raw: ProductFormValues) {
    if (!profileOk) {
      toast.error("Completa tu perfil antes de publicar productos");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Asegurar conversión/validación según schema
      const values = productSchema.parse(raw);

      const imageUrls = await uploadImages(user.id);

      const payload = {
        user_id: user.id,
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        price: values.price,
        quantity_value: values.quantity_value,
        quantity_unit: values.quantity_unit,
        location: `${values.city}, ${values.province}`,
        created_at: new Date().toISOString(),
      } as const;

      // Intento de inserción (si la tabla no existe, informamos)
      // Crear producto y recuperar su id
      const { data: createdProduct, error: insertError } = await supabase
        .from("products")
        .insert(payload as any)
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Registrar imágenes en tabla product_images para enforcement en BD
      if (createdProduct?.id && imageUrls.length) {
        const rows = imageUrls.map((url) => ({ product_id: createdProduct.id, url }));
        const { error: piError } = await supabase.from("product_images").insert(rows as any);
        if (piError) {
          // No bloqueamos el flujo si falla parcialmente, pero notificamos
          console.error(piError);
          toast.error("Algunas imágenes no pudieron registrarse (límite o error). Puedes editar el producto luego.");
        }
      }

      toast.success("Producto creado");
      router.replace("/dashboard/products");
      router.refresh();
    } catch (e: any) {
      console.error("Create product failed", e);
      const msg = e?.message ?? String(e);
      if (/relation\s+\"?products\"?\s+does not exist/i.test(msg)) {
        toast.error("Backend aún no disponible (tabla products). El formulario ya está listo.");
      } else if (/relation\s+\"?product_images\"?\s+does not exist/i.test(msg)) {
        toast.error("Falta la tabla 'product_images' en BD. Ejecuta la migración propuesta.");
      } else if (/Límite de imágenes por producto alcanzado/i.test(msg)) {
        toast.error("Límite de imágenes por producto alcanzado para tu plan.");
      } else if (/bucket.*not.*found/i.test(msg)) {
        toast.error("Falta el bucket 'product-images' en Supabase Storage. Crea el bucket o ajusta la config.");
      } else if (/row-level security|RLS|permission denied|not authorized/i.test(msg)) {
        toast.error("Permisos insuficientes para crear producto (RLS). Revisa políticas en Supabase.");
      } else {
        toast.error(`No se pudo crear el producto: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
      {!profileOk && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
          Para publicar productos, primero completa tu perfil (incluye tu CP). Ve al Dashboard y completa los datos requeridos.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title" className={showError("title") ? "text-red-600" : undefined}>
          Título <span className="text-red-600">*</span>
        </Label>
        <Input id="title" maxLength={20} {...form.register("title")} disabled={saving} className={fieldErrorClass("title")} />
        <div className="text-xs text-muted-foreground">{(form.watch("title")?.length ?? 0)} / 20 caracteres</div>
        {showError("title") && (
          <p className="text-xs text-red-600">{form.getFieldState("title", form.formState).error?.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className={showError("description") ? "text-red-600" : undefined}>
          Descripción <span className="text-red-600">*</span>
        </Label>
        <Textarea id="description" rows={5} maxLength={250} {...form.register("description")} disabled={saving} className={fieldErrorClass("description")} />
        <div className="text-[11px] text-muted-foreground">{(form.watch("description")?.length ?? 0)} / 250 caracteres</div>
        {showError("description") && (
          <p className="text-xs text-red-600">{form.getFieldState("description", form.formState).error?.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label className={showError("category") ? "text-red-600" : undefined}>Categoría <span className="text-red-600">*</span></Label>
          <Select
            value={form.watch("category") || ""}
            onValueChange={(v) => form.setValue("category", v, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
            disabled={saving || loadingCategories}
          >
            <SelectTrigger className={fieldErrorClass("category")}>
              <SelectValue placeholder={loadingCategories ? "Cargando..." : "Selecciona"} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showError("category") && (
            <p className="text-xs text-red-600">{form.getFieldState("category", form.formState).error?.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label className={showError("price") ? "text-red-600" : undefined}>Precio (ARS) <span className="text-red-600">*</span></Label>
          <Input inputMode="decimal" placeholder="0,00" {...form.register("price")} disabled={saving} className={fieldErrorClass("price")} />
          {showError("price") && (
            <p className="text-xs text-red-600">{form.getFieldState("price", form.formState).error?.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label className={showError("quantity_value") ? "text-red-600" : undefined}>Cantidad <span className="text-red-600">*</span></Label>
          <div className="flex gap-2">
            <Input inputMode="decimal" placeholder="0" {...form.register("quantity_value")} disabled={saving} className={fieldErrorClass("quantity_value")} />
            <Select onValueChange={(v) => form.setValue("quantity_unit", v as any, { shouldValidate: true, shouldDirty: true, shouldTouch: true })} disabled={saving}>
              <SelectTrigger className={fieldErrorClass("quantity_unit") + " w-36"}>
                <SelectValue placeholder="Unidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unidad">Unidades</SelectItem>
                <SelectItem value="kg">Kg</SelectItem>
                <SelectItem value="tn">Toneladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(showError("quantity_value") || showError("quantity_unit")) && (
            <p className="text-xs text-red-600">Revisa cantidad y unidad</p>
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

      <div className="space-y-2">
        <Label>Imágenes</Label>
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed p-8 text-sm ${(!isFull && !saving && isDragging) ? "border-orange-500 bg-orange-50" : "border-muted"} ${(saving || isFull) ? "opacity-60 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !(saving || isFull) && fileInputRef.current?.click()}
          role="button"
          aria-disabled={saving || isFull}
          tabIndex={(saving || isFull) ? -1 : 0}
          onKeyDown={(e) => {
            if (saving || isFull) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <UploadCloud className="h-8 w-8 text-[#f06d04]" />
          <p className="text-center text-muted-foreground">Arrastra y suelta imágenes aquí o</p>
          <Button type="button" variant="outline" disabled={saving || isFull} className="bg-white text-[#f06d04] border border-[#f06d04] hover:bg-[#f06d04]/10">
            Seleccionar imágenes
          </Button>
          <input
            ref={fileInputRef}
            id="product-images-input"
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            disabled={saving || isFull}
            onChange={(e) => appendFiles(e.target.files || [])}
          />
          <p className="text-[11px] text-muted-foreground">Formatos soportados: JPG, PNG, WEBP. Máx {maxFiles} imágenes, {MAX_SIZE_MB}MB c/u.</p>
        </div>

        {isFull && (
          <div className="mt-1 text-[11px] text-amber-700">
            Límite de imágenes alcanzado para tu plan ({maxFiles}). Elimina alguna imagen o mejora tu plan.
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {files.map((f, i) => (
              <div
                key={i}
                className="group relative h-24 w-full cursor-zoom-in overflow-hidden rounded border"
                onClick={() => setPreviewIndex(i)}
              >
                <Image src={URL.createObjectURL(f)} alt={f.name} fill className="object-cover" />
                <button
                  type="button"
                  aria-label="Eliminar imagen"
                  className="absolute right-1 top-1 hidden rounded px-2 py-0.5 text-[11px] bg-red-600/10 text-red-800 hover:bg-red-600 hover:text-white group-hover:block transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground">{files.length} / {maxFiles} imágenes seleccionadas</div>

        {previewIndex !== null && files[previewIndex] && (
          <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Vista previa</DialogTitle>
              </DialogHeader>
              <div className="relative w-full" style={{ minHeight: "50vh" }}>
                <Image
                  src={URL.createObjectURL(files[previewIndex])}
                  alt={files[previewIndex].name}
                  fill
                  className="rounded bg-black object-contain"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPreviewIndex((idx) => (idx === null ? idx : (idx - 1 + files.length) % files.length))
                  }
                  disabled={files.length <= 1}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
                </Button>
                <div className="text-xs text-muted-foreground">{(previewIndex ?? 0) + 1} / {files.length}</div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewIndex((idx) => (idx === null ? idx : (idx + 1) % files.length))}
                  disabled={files.length <= 1}
                >
                  Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={saving} onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !profileOk} className="bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-600">
          {saving ? "Guardando..." : "Publicar"}
        </Button>
      </div>
    </form>
  );
}
