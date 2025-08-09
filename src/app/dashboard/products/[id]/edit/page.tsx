import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Editar anuncio #{params.id}</h1>
      <p className="text-sm text-muted-foreground">Formulario de edición (placeholder)</p>
      <div className="rounded border p-4 text-sm text-muted-foreground bg-muted/10">
        Aquí irá el formulario con datos precargados, pausar/eliminar y guardar cambios.
      </div>
    </main>
  );
}
