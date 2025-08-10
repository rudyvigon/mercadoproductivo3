import LoginForm from "@/components/auth/login-form";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Iniciar sesión | Mercado Productivo",
};

export default async function Page() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    redirect("/");
  }
  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-3xl font-bold tracking-tight">Iniciar sesión</CardTitle>
        <CardDescription>Ingresa tus credenciales para acceder a tu cuenta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LoginForm />
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground text-center">
        <div>
          ¿No tienes una cuenta? <Link className="text-primary underline-offset-4 hover:underline" href="/auth/register">Regístrate</Link>
        </div>
        <div>
          <Link className="text-primary underline-offset-4 hover:underline" href="/auth/forgot-password">¿Olvidaste tu contraseña?</Link>
        </div>
      </CardFooter>
    </Card>
  );
}
