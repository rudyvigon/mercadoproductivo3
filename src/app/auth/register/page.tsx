import RegisterForm from "@/components/auth/register-form";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Registro | Mercado Productivo",
};

export default async function Page() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    redirect("/");
  }
  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="p-5 pb-3 space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">Crear una cuenta</CardTitle>
        <CardDescription>Ingresa tus datos para crear una cuenta</CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 pb-4">
        <RegisterForm />
      </CardContent>
      <CardFooter className="px-5 pt-0 pb-5 text-sm text-muted-foreground justify-center text-center">
        ¿Ya tienes una cuenta?
        <Link className="ml-3 text-primary underline-offset-4 hover:underline" href="/auth/login">Inicia sesión</Link>
      </CardFooter>
    </Card>
  );
}
