import { ReactNode } from "react";
import { AuthLeftHero } from "@/components/auth/auth-left-hero";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh grid lg:grid-cols-2 bg-white">
      {/* Izquierda: hero con gradiente */}
      <aside className="hidden lg:block">
        <AuthLeftHero />
      </aside>
      {/* Derecha: contenedor del contenido */}
      <section className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[600px]">{children}</div>
      </section>
    </main>
  );
}
