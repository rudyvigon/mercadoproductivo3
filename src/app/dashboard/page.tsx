import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/auth/signout-button";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle2, PackagePlus, ShoppingBasket, UserRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const firstName = (user.user_metadata?.first_name || user.user_metadata?.firstName || user.user_metadata?.full_name || "").toString().split(" ")[0] || user.email?.split("@")[0] || "Usuario";
  const role = (user.user_metadata?.role || "").toString();
  const emailVerified = Boolean(user.email_confirmed_at);
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "-";

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de control</h1>
          <p className="text-muted-foreground">Bienvenido, {firstName}.</p>
        </div>
        <div className="shrink-0">
          <SignOutButton />
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
              <Button asChild className="justify-start gap-2" variant="default">
                <Link href="/dashboard/products/new">
                  <PackagePlus size={16} />
                  Nuevo producto
                </Link>
              </Button>
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
              <Button asChild className="justify-start gap-2" variant="outline">
                <Link href="/profile">
                  <UserRound size={16} />
                  Editar perfil
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Próximos pasos</CardTitle>
            <CardDescription>Recomendaciones para sacarle provecho</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>Completa tu perfil con datos de contacto y empresa.</li>
              <li>Publica tu primer producto desde <span className="underline"><Link href="/dashboard/products/new">Nuevo producto</Link></span>.</li>
              <li>Explora el <span className="underline"><Link href="/catalog">Marketplace</Link></span> y guarda favoritos.</li>
              <li>Revisa tus productos en <span className="underline"><Link href="/dashboard/products">Mis productos</Link></span>.</li>
            </ul>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString()}
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
