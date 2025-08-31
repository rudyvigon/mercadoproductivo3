export type ChatTimelineItem = {
  type: "incoming" | "outgoing";
  sender_name?: string | null;
  sender_email?: string | null;
  avatar_url?: string | null;
  created_at?: string;
};

export function normalizeAvatarUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  // Normalizar rutas de Supabase Storage públicas
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clean = (p: string) => p.replace(/^\/+/, "");
  // Caso: ya viene con /storage/v1/object/public/ relativo
  if (s.startsWith("/storage/v1/object/public/")) {
    return base ? `${base}/${clean(s)}` : s;
  }
  // Caso: ya viene con storage/v1/object/public/ sin slash inicial
  if (s.startsWith("storage/v1/object/public/")) {
    return base ? `${base}/${s}` : `/${s}`;
  }
  // Caso: viene completo con dominio (pero no http, ej: xyz.supabase.co/storage/...)
  if (/^[\w.-]+\.[\w.-]+\/.+\/storage\/v1\/object\/public\//i.test(s)) {
    return `https://${s}`;
  }
  // Caso: path tipo bucket/key o public/bucket/key
  if (base) {
    const p = s.replace(/^\/?public\//, "");
    return `${base}/storage/v1/object/public/${p}`;
  }
  // Aceptar cualquier referencia que contenga el path público (fallback)
  if (s.includes("/storage/v1/object/public/")) return s;
  return undefined;
}

export function displayNameFromTimeline(
  timeline: ChatTimelineItem[] | undefined,
  fallback?: string | null
): string | null {
  try {
    const lastIncoming = (timeline || [])
      .slice()
      .filter((t) => t.type === "incoming")
      .pop();
    const n = (lastIncoming?.sender_name || "").toString().trim();
    if (n) return n;
  } catch {}
  const byProp = (fallback || "").toString().trim();
  return byProp || null;
}

export function headerAvatarFromTimeline(
  timeline: ChatTimelineItem[] | undefined,
  fallbackUrl?: string | null
): string | undefined {
  try {
    const lastIncoming = (timeline || [])
      .slice()
      .filter((t) => t.type === "incoming")
      .pop();
    const fromTimeline = normalizeAvatarUrl(lastIncoming?.avatar_url);
    if (fromTimeline) return fromTimeline;
  } catch {}
  return normalizeAvatarUrl(fallbackUrl);
}

export function avatarAltHeader(name?: string | null): string {
  return (name || "").toString().trim() || "Usuario";
}

export function avatarAltIncoming(name?: string | null, email?: string | null): string {
  const n = (name || "").toString().trim();
  if (n) return n;
  const e = (email || "").toString().trim();
  return e || "Usuario";
}

export function avatarAltOutgoing(name?: string | null, email?: string | null): string {
  const n = (name || "").toString().trim();
  if (n) return n;
  const e = (email || "").toString().trim();
  return e || "Tú";
}

export type PublicProfile = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company?: string | null;
  city?: string | null;
  province?: string | null;
  avatar_url?: string | null;
  plan_code?: string | null;
};

export function displayNameFromProfile(
  p?: Partial<PublicProfile> | null,
  fallback?: string | null
): string | null {
  const company = (p?.company || "").toString().trim();
  if (company) return company;
  const full = (p?.full_name || "").toString().trim();
  if (full) return full;
  const first = (p?.first_name || "").toString().trim();
  const last = (p?.last_name || "").toString().trim();
  const composed = [first, last].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  const fb = (fallback || "").toString().trim();
  return fb || null;
}

export function headerAvatarFromProfile(
  p?: Partial<PublicProfile> | null,
  fallbackUrl?: string | null
): string | undefined {
  return normalizeAvatarUrl(p?.avatar_url) || normalizeAvatarUrl(fallbackUrl);
}

export function initialFrom(
  name?: string | null,
  email?: string | null,
  fallback: string = "U"
): string {
  const base = (name || email || fallback || "U").toString();
  const c = base.trim().charAt(0).toUpperCase();
  return c || fallback.toUpperCase();
}
