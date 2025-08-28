import { ReactNode } from "react";
import DashboardSidebar from "@/components/dashboard/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNormalizedRoleFromUser } from "@/lib/auth/role";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Guardia adicional del lado del servidor (además del middleware)
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = getNormalizedRoleFromUser(user);
  if (role !== "seller") {
    redirect("/profile");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 lg:ml-0">
        {/* Espaciado superior para el botón hamburguesa en móvil */}
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
