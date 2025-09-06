"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";
import SupabaseListener from "@/components/supabase/supabase-listener";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");

  return (
    <div className={`flex min-h-screen w-full flex-col ${!isAuth ? 'pt-header-safe' : ''}`}>
      {/* Sincroniza la cookie de sesión de Supabase en cliente */}
      <SupabaseListener />
      {!isAuth && <SiteHeader />}
      <main className="flex-1 w-full">
        {children}
      </main>
      {!isAuth && <SiteFooter />}
    </div>
  );
}
