import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileFormCard from "@/components/profile/profile-form-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Si es vendedor, mantener edición de perfil dentro del dashboard
  const roleRaw = (user.user_metadata?.role || (user as any).user_metadata?.user_type || "").toString();
  const roleNormalized = roleRaw === "anunciante" ? "seller" : roleRaw;
  const isSeller = roleNormalized === "seller";
  if (isSeller) {
    redirect("/dashboard/profile");
  }

  // Compradores: perfil público/independiente
  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4 sm:p-6 sm:space-y-6">
      <ProfileFormCard />
    </div>
  );
}
