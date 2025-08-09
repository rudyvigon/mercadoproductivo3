import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ProductsDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mis anuncios</h1>
        <Button
          asChild
          className="relative overflow-hidden group bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-600"
        >
          <Link href="/dashboard/products/new">
            <span className="pointer-events-none absolute -left-20 top-0 h-full w-1/3 -skew-x-12 bg-white/30 transition-transform duration-500 group-hover:translate-x-[200%]" />
            <Plus size={16} />
            <span>+ Nuevo Producto</span>
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Listado de anuncios (placeholder)</p>
      <div className="rounded border p-4 text-sm text-muted-foreground bg-muted/10">
        No hay anuncios todavía.
      </div>
    </main>
  );
}
