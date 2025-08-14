import { createClient } from "@supabase/supabase-js";

// Cliente de administrador (Service Role). USO EXCLUSIVO EN SERVIDOR.
// Requiere variables de entorno:
// - NEXT_PUBLIC_SUPABASE_URL (url del proyecto)
// - SUPABASE_SERVICE_ROLE_KEY (clave service role, NO exponer al cliente)
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan variables de entorno para Supabase Admin (URL o SERVICE_ROLE_KEY)");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
