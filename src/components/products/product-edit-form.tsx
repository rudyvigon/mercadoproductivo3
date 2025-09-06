"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ClipboardEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  Trash2, 
  AlertCircle, 
  Star,
  Image as ImageIcon,
  DollarSign,
  Package,
  UploadCloud,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { buildSafeStoragePath, pathFromPublicUrl, getPublicUrlForPath } from "@/lib/images";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
  quantity_value: number;
  quantity_unit: string;
  featured_until?: string;
  created_at: string;
  user_id: string;
}

interface ProductEditFormProps {
  product: Product;
  canPublish: boolean;
}

const QUANTITY_UNITS = [
  "kg", "toneladas", "litros", "unidades", "hectáreas", "horas"
];

const TITLE_MAX = 20;
const DESC_MAX = 250;

// Provincias de Argentina
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

export default function ProductEditForm({ product, canPublish }: ProductEditFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [gallery, setGallery] = useState<{ id: string; url: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [maxFiles, setMaxFiles] = useState<number>(6);
  const [canFeature, setCanFeature] = useState<boolean>(true);
  const [featureCost, setFeatureCost] = useState<number | null>(null);
  const MAX_SIZE_MB = 5;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const isFull = (gallery.length + pendingFiles.length) >= maxFiles;
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  // Estado del formulario
  const parseLocation = (loc: string) => {
    const [cityPart, ...provParts] = (loc || "").split(",");
    const city = (cityPart || "").trim();
    const province = provParts.join(",").trim();
    return { city, province };
  };
  const { city: initialCity, province: initialProvince } = parseLocation(product.location || "");
  const [formData, setFormData] = useState({
    title: product.title,
    description: product.description,
    price: product.price,
    category: product.category,
    province: initialProvince,
    city: initialCity,
    quantity_value: product.quantity_value,
    quantity_unit: product.quantity_unit
  });

  // Estado inicial del formulario para detectar cambios no guardados
  const initialFormRef = useRef({
    title: product.title,
    description: product.description,
    price: product.price,
    category: product.category,
    province: initialProvince,
    city: initialCity,
    quantity_value: product.quantity_value,
    quantity_unit: product.quantity_unit,
  });
  const hasUnsavedChanges = useMemo(() => {
    try {
      const a = JSON.stringify(formData);
      const b = JSON.stringify(initialFormRef.current);
      return a !== b || pendingFiles.length > 0;
    } catch {
      return pendingFiles.length > 0;
    }
  }, [formData, pendingFiles.length]);

  // (Eliminado guard de History API para evitar dobles prompts)

  // Verificar si el producto está destacado
  const isFeature = product.featured_until && new Date(product.featured_until) > new Date();

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // --- Validaciones de entrada: bloquear números en el título ---
  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key && e.key.length === 1 && /[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleTitleBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const data = (e as any)?.nativeEvent?.data as string | null;
    if (data && /[0-9]/.test(data)) {
      e.preventDefault();
    }
  };

  const handleTitlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (/[0-9]/.test(text)) {
      e.preventDefault();
      const sanitized = text.replace(/[0-9]/g, "");
      const el = e.target as HTMLInputElement;
      const prev = el.value || "";
      const start = el.selectionStart ?? prev.length;
      const end = el.selectionEnd ?? prev.length;
      const next = prev.slice(0, start) + sanitized + prev.slice(end);
      setFormData((p) => ({ ...p, title: next }));
      // Restaurar cursor
      requestAnimationFrame(() => {
        try {
          el.selectionStart = el.selectionEnd = start + sanitized.length;
        } catch {}
      });
    }
  };

  // --- Gestión de imágenes (galería) ---
  const appendFiles = (newFiles: FileList | File[]) => {
    if (loading || isFull) return;
    const all = Array.from(newFiles);
    const images = all.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const tooBig = images.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (tooBig.length) {
      toast.error(`Algunas imágenes superan ${MAX_SIZE_MB}MB y fueron omitidas`);
    }
    const accepted = images.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    setPendingFiles((prev) => {
      const remainingSlots = Math.max(0, maxFiles - gallery.length - prev.length);
      const next = [...prev, ...accepted.slice(0, remainingSlots)];
      if (accepted.length > remainingSlots) {
        toast.error(`Máximo ${maxFiles} imágenes por producto`);
      }
      return next;
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) {
      appendFiles(files);
      // permitir volver a seleccionar el mismo archivo
      e.target.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (loading || isFull) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (loading || isFull) return;
    if (e.dataTransfer?.files?.length) {
      appendFiles(e.dataTransfer.files);
    }
  }

  const loadGallery = async () => {
    const { data, error } = await supabase
      .from("product_images")
      .select("id,url")
      .eq("product_id", product.id)
      .order("id", { ascending: true });
    if (!error && data) setGallery(data as any);
  };

  const urlToPath = (url: string) => pathFromPublicUrl(url);

  // Normaliza URLs existentes en BD para este producto (asegura encoding correcto)
  const normalizeImageUrlsForProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("product_images")
        .select("id,url")
        .eq("product_id", product.id);
      if (error || !data) return;
      for (const row of data as Array<{ id: string; url: string }>) {
        const path = row.url ? pathFromPublicUrl(row.url) : null;
        if (!path) continue;
        const newUrl = getPublicUrlForPath(supabase, "product-images", path);
        if (newUrl && newUrl !== row.url) {
          await supabase
            .from("product_images")
            .update({ url: newUrl })
            .eq("id", row.id)
            .eq("product_id", product.id);
        }
      }
    } catch (e) {}
  };

  const deleteImage = async (id: string, url: string, opts?: { skipConfirm?: boolean }) => {
    try {
      if (!opts?.skipConfirm && typeof window !== "undefined" && typeof window.confirm === "function") {
        const ok = window.confirm("¿Eliminar esta imagen?");
        if (!ok) {
          toast.message("Eliminación cancelada");
          return;
        }
      }
    } catch {}
    setDeletingImageId(id);
    try {
      const path = urlToPath(url);
      if (!path) {
        toast.warning("No se pudo resolver la ruta de storage, se eliminará solo el registro.");
      }
      // Intento de eliminar en Storage (no bloquea)
      if (path) {
        const { error: storageErr } = await supabase.storage.from("product-images").remove([path]);
        if (storageErr) {
          toast.message("No se encontró el archivo en Storage. Se elimina referencia en BD.");
        }
      }
      // Eliminar registro en BD reforzando RLS por ownership
      const { error: dbErr } = await supabase
        .from("product_images")
        .delete()
        .eq("id", id)
        .eq("product_id", product.id);
      if (dbErr) {
        console.error(dbErr);
        toast.error("No se pudo eliminar la imagen en BD (RLS).");
        return;
      }
      // Optimista: remover de la UI inmediata
      setGallery((prev) => prev.filter((g) => g.id !== id));
      // Refresco desde servidor para asegurar consistencia
      await loadGallery();
      toast.success("Imagen eliminada");
    } catch (error) {
      toast.error("Ocurrió un error al eliminar la imagen.");
    } finally {
      setDeletingImageId(null);
    }
  };

  // --- Localidades dinámicas ---
  async function fetchCities(prov: string) {
    if (!prov) {
      setCities([]);
      return;
    }
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

  useEffect(() => {
    // Primero normalizamos posibles URLs mal codificadas, luego cargamos
    (async () => {
      await normalizeImageUrlsForProduct();
      await loadGallery();
    })();
    if (formData.province) fetchCities(formData.province);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// Cargar categorías desde tabla `categories` (fallback a products.category)
useEffect(() => {
  (async () => {
    setLoadingCategories(true);
    try {
      // 1) Intentar leer desde tabla maestra `categories`
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
        );
        if (product.category && !list.includes(product.category)) {
          list.unshift(product.category);
        }
        list.sort((a, b) => a.localeCompare(b));
        setCategories(list);
        return;
      }

      // 2) Fallback: deducir desde products.category
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
      );
      if (product.category && !list.includes(product.category)) {
        list.unshift(product.category);
      }
      list.sort((a, b) => a.localeCompare(b));
      setCategories(list);
    } catch {
      const fallback = product.category ? [product.category] : [];
      setCategories(fallback);
    } finally {
      setLoadingCategories(false);
    }
  })();
}, [supabase, product.category]);

// Resolver límites por plan desde la tabla `plans`
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
        setCanFeature(true);
        setFeatureCost(10);
        return;
      }
      const { data: plan } = await supabase
        .from('plans')
        .select('max_images_per_product, can_feature, feature_cost')
        .eq('code', planCode)
        .maybeSingle();
      const maxImages = Number((plan as any)?.max_images_per_product) || 5;
      setMaxFiles(maxImages);
      setCanFeature(Boolean((plan as any)?.can_feature ?? true));
      const fc: any = (plan as any)?.feature_cost;
      setFeatureCost(typeof fc === 'number' ? fc : (fc ? Number(fc) : 10));
    } catch {
      // Fallback por seguridad
      setMaxFiles(5);
      setCanFeature(true);
      setFeatureCost(10);
    }
  })();
}, [supabase]);

  useEffect(() => {
    fetchCities(formData.province);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.province]);

  const handleSave = async () => {
    // Validación de que el título no contenga números
    if (/[0-9]/.test((formData.title || ""))) {
      toast.error("El título no puede contener números");
      return;
    }
    // Validación de longitudes antes de guardar
    if ((formData.title || "").length > TITLE_MAX) {
      toast.error(`El título supera ${TITLE_MAX} caracteres`);
      return;
    }
    if ((formData.description || "").length > DESC_MAX) {
      toast.error(`La descripción supera ${DESC_MAX} caracteres`);
      return;
    }
    setLoading(true);
    try {
      const { province, city, ...rest } = formData as any;
      const updatePayload = {
        ...rest,
        location: `${city}, ${province}`.trim(),
      };

      const { error } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", product.id)
        .eq("user_id", product.user_id);

      if (error) throw error;

      // Subir nuevas imágenes si hay
      if (pendingFiles.length) {
        const uploadedUrls: string[] = [];
        for (const f of pendingFiles) {
          const { path } = buildSafeStoragePath({ userId: product.user_id, productId: product.id, file: f });
          const { error: upErr } = await supabase.storage.from("product-images").upload(path, f, {
            cacheControl: "3600",
            upsert: false,
            contentType: f.type || undefined,
          });
          if (upErr) throw upErr;
          const { data } = supabase.storage.from("product-images").getPublicUrl(path);
          if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
        }
        if (uploadedUrls.length) {
          const rows = uploadedUrls.map((url) => ({ product_id: product.id, url }));
          const { error: insErr } = await supabase.from("product_images").insert(rows as any);
          if (insErr) {
            console.error(insErr);
            toast.error("Imágenes subidas pero no registradas en la base de datos.");
          }
        }
        setPendingFiles([]);
        await loadGallery();
      }

      toast.success("Producto actualizado correctamente");
      // Actualizamos referencia para marcar estado "sin cambios"
      initialFormRef.current = { ...formData } as any;
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar el producto");
    } finally {
      setLoading(false);
    }
  };

  // Aviso al intentar abandonar la página con cambios no guardados (recarga/cierre)
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges]);

  // Interceptar clics en enlaces internos cuando hay cambios sin guardar
  useEffect(() => {
    const handler = async (e: MouseEvent) => {
      if (!hasUnsavedChanges) return; // sin cambios -> no interfiere
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      let href = anchor.getAttribute('href') || '';
      if (!href || href === '#') return;
      // Ignorar nuevas pestañas/teclas modificadoras/descargas/mailto/external
      if (
        anchor.target === '_blank' ||
        (e as any).metaKey || (e as any).ctrlKey || (e as any).shiftKey || (e as any).altKey ||
        anchor.hasAttribute('download') || href.startsWith('mailto:') || href.startsWith('tel:') ||
        (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin))
      ) {
        return;
      }
      // Tomar control y preguntar
      e.preventDefault();
      e.stopPropagation();
      let ok = false;
      try {
        const mod = await import('../ui/confirm-modal');
        ok = await mod.default({
          title: '¿Salir sin guardar?',
          description: 'Tienes cambios sin guardar. Si sales, se perderán.',
          confirmText: 'Salir sin guardar',
          cancelText: 'Cancelar',
        });
      } catch {
        ok = window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
      }
      if (!ok) return;
      // Normalizar a ruta relativa para router.push
      const isAbsolute = /^https?:\/\//i.test(href);
      if (isAbsolute) {
        try {
          const u = new URL(href);
          href = u.pathname + u.search + u.hash;
        } catch {}
      }
      await router.push(href);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [hasUnsavedChanges, router]);

  // Interceptar botón atrás del navegador
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (!hasUnsavedChanges) return;
      const open = async () => {
        try {
          const mod = await import('../ui/confirm-modal');
          const ok = await mod.default({
            title: '¿Salir sin guardar?',
            description: 'Tienes cambios sin guardar. Si sales, se perderán.',
            confirmText: 'Salir sin guardar',
            cancelText: 'Cancelar',
          });
          if (!ok) {
            history.pushState(null, '', window.location.href);
          }
        } catch {
          const ok = window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
          if (!ok) {
            history.pushState(null, '', window.location.href);
          }
        }
      };
      void open();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [hasUnsavedChanges]);

  // (Guard de History API eliminado)

  const handleDelete = async () => {
    // Confirmación con modal custom (fallback a confirm nativo)
    let ok = false;
    try {
      const mod = await import('../ui/confirm-modal');
      ok = await mod.default({
        title: '¿Eliminar producto?',
        description: 'Se eliminará el producto y todas sus imágenes asociadas. Esta acción no se puede deshacer.',
        confirmText: 'Eliminar definitivamente',
        cancelText: 'Cancelar',
      });
    } catch {
      ok = window.confirm('¿Eliminar el producto y todas sus imágenes? Esta acción no se puede deshacer.');
    }
    if (!ok) return;

    setDeleting(true);
    try {
      // 1) Obtener imágenes asociadas
      const { data: imgs, error: imgsErr } = await supabase
        .from('product_images')
        .select('id,url')
        .eq('product_id', product.id);
      if (imgsErr) throw imgsErr;

      // 2) Borrar archivos en Storage (si existen)
      const paths = (imgs || [])
        .map((r: any) => r?.url ? urlToPath(r.url) : null)
        .filter((p: any): p is string => !!p);
      if (paths.length) {
        const { error: storageErr } = await supabase.storage.from('product-images').remove(paths);
        if (storageErr) {
          // Continuamos, quizá ya no existen; se limpiará la BD igual
          console.warn('Error al eliminar archivos de Storage:', storageErr);
        }
      }

      // 3) Borrar registros de imágenes en BD
      const { error: delImgsErr } = await supabase
        .from('product_images')
        .delete()
        .eq('product_id', product.id);
      if (delImgsErr) throw delImgsErr;

      // 4) Borrar el producto (reforzando ownership)
      const { error: delProdErr } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
        .eq('user_id', product.user_id);
      if (delProdErr) throw delProdErr;

      toast.success('Producto e imágenes eliminados correctamente');
      await router.push('/dashboard/products');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Error al eliminar el producto');
      setDeleting(false);
    }
  };

  const handleFeature = async () => {
    try {
      if (isFeature) {
        // Confirmar antes de quitar destacado
        let ok = false;
        try {
          const mod = await import('../ui/confirm-modal');
          ok = await mod.default({
            title: '¿Quitar destacado?',
            description: 'El producto dejará de aparecer en la sección de destacados.',
            confirmText: 'Quitar destacado',
            cancelText: 'Cancelar',
          });
        } catch {
          ok = window.confirm('¿Quitar el destacado de este producto?');
        }
        if (!ok) return;
        setLoading(true);
        // Quitar destacado (sin costo), reforzando ownership
        const { error } = await supabase
          .from('products')
          .update({ featured_until: null })
          .eq('id', product.id)
          .eq('user_id', product.user_id);
        if (error) throw error;
        toast.success("Producto quitado de destacados");
      } else {
        // Validar permiso por plan para destacar
        if (!canFeature) {
          toast.error('Tu plan actual no permite destacar productos');
          return;
        }
        setLoading(true);
        // Destacar (con costo de créditos) vía API
        const res = await fetch('/api/products/feature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, days: 3, cost: featureCost ?? 10 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'No se pudo destacar el producto');
        }
        toast.success("Producto destacado por 3 días");
      }
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Error al modificar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Galería de imágenes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Galería de imágenes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gallery.map((img) => (
                <div key={img.id} className="relative z-0 group rounded-lg overflow-hidden border h-32">
                  <Image src={img.url} alt={product.title} fill className="object-cover pointer-events-none select-none" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteImage(img.id, img.url, { skipConfirm: true }); }}
                    disabled={deletingImageId === img.id}
                    className={`absolute top-1 right-1 z-20 inline-flex items-center rounded p-1 text-white pointer-events-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition ${deletingImageId === img.id ? "bg-gray-400 cursor-wait" : "bg-red-600/80"}`}
                    aria-busy={deletingImageId === img.id}
                    aria-label="Eliminar imagen"
                    tabIndex={0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full rounded-lg bg-muted flex items-center justify-center p-6 text-muted-foreground">
              <div className="text-center">
                <Package className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">Sin imágenes</p>
              </div>
            </div>
          )}

          {/* Agregar nuevas imágenes (UI unificada con creación) */}
          <div>
            <Label>Imágenes</Label>
            <div
              className={`flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed p-8 text-sm ${(!isFull && !loading && isDragging) ? "border-orange-500 bg-orange-50" : "border-muted"} ${(loading || isFull) ? "opacity-60 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !(loading || isFull) && fileInputRef.current?.click()}
              role="button"
              aria-disabled={loading || isFull}
              tabIndex={(loading || isFull) ? -1 : 0}
              onKeyDown={(e) => {
                if (loading || isFull) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <UploadCloud className="h-8 w-8 text-[#f06d04]" />
              <p className="text-center text-muted-foreground">Arrastra y suelta imágenes aquí o</p>
              <Button type="button" variant="outline" disabled={loading || isFull} className="bg-white text-[#f06d04] border border-[#f06d04] hover:bg-[#f06d04]/10">
                Seleccionar imágenes
              </Button>
              <input
                ref={fileInputRef}
                id="product-images-input-edit"
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                disabled={loading || isFull}
                onChange={(e) => handleFileInputChange(e)}
              />
              <p className="text-[11px] text-muted-foreground">Formatos soportados: JPG, PNG, WEBP. Máx {maxFiles} imágenes, {MAX_SIZE_MB}MB c/u.</p>
            </div>

            {isFull && (
              <div className="mt-1 text-[11px] text-amber-700">
                Límite de imágenes alcanzado para tu plan ({maxFiles}). Elimina alguna imagen o mejora tu plan.
              </div>
            )}

            {pendingFiles.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {pendingFiles.map((f, i) => (
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
                        removePendingFile(i);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">{gallery.length + pendingFiles.length} / {maxFiles} imágenes seleccionadas</div>

            {previewIndex !== null && pendingFiles[previewIndex] && (
              <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Vista previa</DialogTitle>
                  </DialogHeader>
                  <div className="relative w-full" style={{ minHeight: "50vh" }}>
                    <Image
                      src={URL.createObjectURL(pendingFiles[previewIndex])}
                      alt={pendingFiles[previewIndex].name}
                      fill
                      className="rounded bg-black object-contain"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPreviewIndex((idx) => (idx === null ? idx : (idx - 1 + pendingFiles.length) % pendingFiles.length))
                      }
                      disabled={pendingFiles.length <= 1}
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
                    </Button>
                    <div className="text-xs text-muted-foreground">{(previewIndex ?? 0) + 1} / {pendingFiles.length}</div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPreviewIndex((idx) => (idx === null ? idx : (idx + 1) % pendingFiles.length))}
                      disabled={pendingFiles.length <= 1}
                    >
                      Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información básica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Información básica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Título */}
            <div>
              <Label htmlFor="title">Título del producto *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Ej: Soja de excelente calidad"
                maxLength={TITLE_MAX}
                inputMode="text"
                onKeyDown={handleTitleKeyDown}
                onBeforeInput={handleTitleBeforeInput}
                onPaste={handleTitlePaste}
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground">{(formData.title?.length ?? 0)} / {TITLE_MAX} caracteres</div>
            </div>

            {/* Descripción */}
            <div>
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe las características, calidad, condiciones..."
                rows={4}
                maxLength={DESC_MAX}
                className="mt-1 resize-none"
              />
              <div className="text-[11px] text-muted-foreground">{(formData.description?.length ?? 0)} / {DESC_MAX} caracteres</div>
            </div>

            {/* Categoría y Ubicación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleInputChange('category', value)}
                  disabled={loadingCategories}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={loadingCategories ? "Cargando..." : "Selecciona una categoría"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

 
              <div>
                <Label htmlFor="province">Provincia *</Label>
                <Select value={formData.province} onValueChange={(value) => handleInputChange('province', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecciona provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {AR_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-3">
                  <Label htmlFor="city">Localidad *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => handleInputChange('city', value)}
                    disabled={!formData.province || loadingCities}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={formData.province ? (loadingCities ? "Cargando..." : "Selecciona localidad") : "Selecciona provincia primero"} />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Precio y cantidad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Precio y cantidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="price">Precio (ARS) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', Number(e.target.value))}
                placeholder="0"
                min="0"
                step="0.01"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="quantity">Cantidad *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity_value}
                onChange={(e) => handleInputChange('quantity_value', Number(e.target.value))}
                placeholder="0"
                min="0"
                step="0.01"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="unit">Unidad *</Label>
              <Select value={formData.quantity_unit} onValueChange={(value) => handleInputChange('quantity_unit', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  {QUANTITY_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado del producto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5" />
            Estado del producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={isFeature ? "default" : "secondary"}>
                  {isFeature ? "Destacado" : "Normal"}
                </Badge>
                {isFeature && (
                  <span className="text-sm text-muted-foreground">
                    hasta {new Date(product.featured_until!).toLocaleDateString('es-ES')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isFeature 
                  ? "Este producto aparece en la sección de destacados" 
                  : "Haz que tu producto aparezca en destacados"
                }
              </p>
              {!isFeature && !canFeature && (
                <p className="text-xs text-muted-foreground">Tu plan no permite destacar productos actualmente.</p>
              )}
            </div>
            <Button
              variant={isFeature ? "outline" : "default"}
              size="sm"
              onClick={handleFeature}
              disabled={loading || (!isFeature && !canFeature)}
              title={!isFeature && !canFeature ? 'Tu plan no permite destacar' : undefined}
            >
              <Star className="h-4 w-4 mr-2" />
              {isFeature ? "Quitar destacado" : "Destacar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        {/* Botón peligroso */}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={loading || deleting}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {deleting ? "Eliminando..." : "Eliminar producto"}
        </Button>

        {/* Botones principales */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !canPublish}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {/* Advertencia si no puede publicar */}
      {!canPublish && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Completa tu perfil para poder publicar productos</span>
        </div>
      )}
    </div>
  );
}
