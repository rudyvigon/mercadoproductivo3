import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/profile/profile-form";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground">Actualiza tu información personal</p>
      </div>
      <ProfileForm />
    </main>
  );
}
