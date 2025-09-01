"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";
import SupabaseListener from "@/components/supabase/supabase-listener";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import MessagesPush from "@/components/notifications/messages-push";
import { normalizeRoleFromMetadata } from "@/lib/auth/role";

// Hook de media query a nivel de módulo
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    try {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    } catch {
      // @ts-ignore - compat Safari
      mql.addListener(onChange);
      return () => {
        try {
          // @ts-ignore
          mql.removeListener(onChange);
        } catch {}
      };
    }
  }, [query]);
  return matches;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const isLarge = useMediaQuery("(min-width: 1024px)");
  const messagesHref = (() => {
    const role = normalizeRoleFromMetadata(user?.user_metadata || {});
    const isSeller = role === "seller";
    return isSeller ? "/dashboard/messages" : "/mensajes";
  })();

  // Cargar usuario y escuchar cambios de auth
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      try { subscription?.unsubscribe(); } catch {}
    };
  }, [supabase]);

  return (
    <div className={`flex min-h-screen w-full flex-col ${!isAuth ? 'pt-header-safe' : ''}`}>
      {/* Sincroniza la cookie de sesión de Supabase en cliente */}
      <SupabaseListener />
      {/* Fallback de notificaciones en escritorio cuando no hay header (rutas /auth) */}
      {isAuth && isLarge && user ? (
        <MessagesPush sellerId={user.id} messagesHref={messagesHref} />
      ) : null}
      {!isAuth && <SiteHeader />}
      <main className="flex-1 w-full">
        {children}
      </main>
      {!isAuth && <SiteFooter />}
    </div>
  );
}
