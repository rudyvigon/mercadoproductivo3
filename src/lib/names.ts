export type NameLike = {
  company?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Obtiene un nombre de visualización preferido para remitentes.
 * Prioriza: company -> full_name -> (first_name + last_name) -> fallback -> "Contacto".
 */
export function getSenderDisplayName(src?: NameLike | null, fallback?: string) {
  const company = String(src?.company ?? "").trim();
  if (company) return company;

  const full = String(src?.full_name ?? "").trim();
  if (full) return full;

  const first = String(src?.first_name ?? "").trim();
  const last = String(src?.last_name ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;

  const fb = String(fallback ?? "").trim();
  if (fb) return fb;

  return "Contacto";
}
