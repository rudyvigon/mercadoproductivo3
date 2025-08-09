"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function createClient() {
  // Usa variables de entorno configuradas en el proyecto automáticamente
  return createClientComponentClient();
}
