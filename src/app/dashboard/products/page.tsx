import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

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
        <Link href="/dashboard/products/new" className="text-primary underline-offset-4 hover:underline">
          Nuevo anuncio
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">Listado de anuncios (placeholder)</p>
      <div className="rounded border p-4 text-sm text-muted-foreground bg-muted/10">
        No hay anuncios todavía.
      </div>
    </main>
  );
}
