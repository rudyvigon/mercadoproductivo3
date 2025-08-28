export type NormalizedRole = "seller" | "buyer" | null;

/**
 * Normaliza el rol usando metadata de usuario.
 * - Acepta `role` y `user_type` (legacy) en user_metadata
 * - Mapea `anunciante` -> `seller`
 * - Mapea `comprador` -> `buyer`
 */
export function normalizeRoleFromMetadata(meta: any): NormalizedRole {
  try {
    const raw = (meta?.role || meta?.user_type || "").toString().trim().toLowerCase();
    if (!raw) return null;
    if (raw === "anunciante" || raw === "seller") return "seller";
    if (raw === "buyer" || raw === "comprador") return "buyer";
    // Si llegamos aquí y el valor no está mapeado, lo devolvemos si coincide con los soportados
    if (raw.includes("seller")) return "seller";
    if (raw.includes("buyer")) return "buyer";
    return null;
  } catch {
    return null;
  }
}

export function getNormalizedRoleFromUser(user: { user_metadata?: any } | null): NormalizedRole {
  if (!user) return null;
  return normalizeRoleFromMetadata(user.user_metadata || {});
}

export function isSellerFromUser(user: { user_metadata?: any } | null): boolean {
  return getNormalizedRoleFromUser(user) === "seller";
}
