import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PackagePlus, ShoppingBasket } from "lucide-react";
import { GuardedCreateButton } from "@/components/dashboard/guarded-create-button";
import ProfileFormCard from "@/components/profile/profile-form-card";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Nombre para saludo
  const firstNameFromMeta = (user.user_metadata?.first_name || user.user_metadata?.firstName || user.user_metadata?.full_name || "").toString().split(" ")[0];
  const role = (user.user_metadata?.role || "").toString();
  const emailVerified = Boolean(user.email_confirmed_at);
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })
    : "-";

  // Traer perfil y determinar campos requeridos para publicar
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, dni_cuit, company, address, city, province, postal_code")
    .eq("id", user.id)
    .single();

  const p_first = (profile?.first_name ?? user.user_metadata?.first_name ?? "").toString();
  const p_last = (profile?.last_name ?? user.user_metadata?.last_name ?? "").toString();
  const full_name = (profile?.full_name ?? `${p_first} ${p_last}`).toString().trim();
  const p_email = (user.email ?? "").toString();
  const p_dni_cuit = (profile?.dni_cuit ?? "").toString();
  const p_company = (profile?.company ?? "").toString();
  const p_address = (profile?.address ?? "").toString();
  const p_city = (profile?.city ?? "").toString();
  const p_province = (profile?.province ?? "").toString();
  const p_cp = (profile?.postal_code ?? "").toString();

  const firstName = p_first || firstNameFromMeta || user.email?.split("@")[0] || "Usuario";

  const missingLabels: string[] = [];
  if (!p_first.trim()) missingLabels.push("Nombre");
  if (!p_last.trim()) missingLabels.push("Apellido");
  if (!p_email.trim()) missingLabels.push("Email");
  if (!p_dni_cuit.trim()) missingLabels.push("DNI o CUIT");
  if (!p_address.trim()) missingLabels.push("Dirección");
  if (!p_city.trim()) missingLabels.push("Localidad");
  if (!p_province.trim()) missingLabels.push("Provincia");
  if (!p_cp.trim()) missingLabels.push("Código Postal");

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de control</h1>
          <p className="text-muted-foreground">Bienvenido, {firstName}.</p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resumen</CardTitle>
            <CardDescription>Estado de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rol</span>
              <span className="font-medium">{role || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verificación</span>
              <Badge variant={emailVerified ? "default" : "secondary"}>
                {emailVerified ? "Verificado" : "No verificado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Último acceso</span>
              <span className="font-medium">{lastSignIn}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Accesos rápidos</CardTitle>
            <CardDescription>Comienza a gestionar tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GuardedCreateButton
                href="/dashboard/products/new"
                missingLabels={missingLabels}
                className="relative overflow-hidden group inline-flex items-center justify-start gap-2 whitespace-nowrap rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-600"
              >
                <span className="pointer-events-none absolute -left-20 top-0 h-full w-1/3 -skew-x-12 bg-white/30 transition-transform duration-500 group-hover:translate-x-[200%]" />
                <PackagePlus size={16} />
                <span>+ Nuevo Producto</span>
              </GuardedCreateButton>
              <Button asChild className="justify-start gap-2" variant="secondary">
                <Link href="/dashboard/products">
                  <CheckCircle2 size={16} />
                  Mis productos
                </Link>
              </Button>
              <Button asChild className="justify-start gap-2" variant="outline">
                <Link href="/catalog">
                  <ShoppingBasket size={16} />
                  Marketplace
                </Link>
              </Button>
              {/* Acceso a Editar perfil removido: el perfil se gestiona en este dashboard */}
            </div>
          </CardContent>
        </Card>

        {missingLabels.length > 0 && (
          <Card id="profile-requirements-card" className="md:col-span-2 xl:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Información requerida para publicar</CardTitle>
              <CardDescription>Debes completar estos campos antes de publicar productos</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                <li className="flex items-center justify-between">
                  <span>Nombre</span>
                  <Badge variant={p_first.trim() ? "default" : "secondary"}>{p_first.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Apellido</span>
                  <Badge variant={p_last.trim() ? "default" : "secondary"}>{p_last.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Email</span>
                  <Badge variant={p_email.trim() ? "default" : "secondary"}>{p_email.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>DNI o CUIT</span>
                  <Badge variant={p_dni_cuit.trim() ? "default" : "secondary"}>{p_dni_cuit.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Dirección</span>
                  <Badge variant={p_address.trim() ? "default" : "secondary"}>{p_address.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Localidad</span>
                  <Badge variant={p_city.trim() ? "default" : "secondary"}>{p_city.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Provincia</span>
                  <Badge variant={p_province.trim() ? "default" : "secondary"}>{p_province.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span>Código Postal</span>
                  <Badge variant={p_cp.trim() ? "default" : "secondary"}>{p_cp.trim() ? "Completo" : "Pendiente"}</Badge>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <a href="#profile-form-card">Completar tu información</a>
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Tarjeta de Perfil embebida con modo edición/lectura */}
        <ProfileFormCard />
      </section>
    </main>
  );
}
