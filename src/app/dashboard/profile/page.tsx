import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileFormCard from "@/components/profile/profile-form-card";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4 sm:p-6 sm:space-y-6">
      {/* Vista enfocada únicamente en el formulario de perfil */}
      <ProfileFormCard />
    </div>
  );
}
