import { createClient } from "@supabase/supabase-js";

// Cliente de administrador (Service Role). USO EXCLUSIVO EN SERVIDOR.
// Requiere variables de entorno:
// - NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL (url del proyecto)
// - SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_KEY) clave service role, NO exponer al cliente
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    // Log explícito para facilitar el diagnóstico en entorno de servidor
    console.error(
      "[Supabase Admin] Faltan variables de entorno. Requeridas: NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY"
    );
    throw new Error("CONFIG_ERROR_SUPABASE_ADMIN_ENV");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
