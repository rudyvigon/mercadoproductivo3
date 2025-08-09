"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseListener() {
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        });
      } catch (e) {
        // Silenciar errores de red; el middleware mantendrá la sesión fresca en próximas requests
        console.error("auth sync error", e);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
