import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MessagesInbox from "@/components/messages/messages-inbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAllowedPlan(plan?: string | null) {
  const code = (plan || "").toLowerCase();
  return ["plus", "enterprise", "premium", "pro", "deluxe", "diamond"].includes(code);
}

export default async function MessagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_code")
    .eq("id", user.id)
    .maybeSingle();

  const allowed = isAllowedPlan(profile?.plan_code);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Mensajes</CardTitle>
            <CardDescription>Disponible solo para planes Plus y Deluxe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Actualiza tu plan para habilitar la mensajería interna y recibir contactos de potenciales clientes.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/dashboard/plan">Ver mi plan</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/planes">Ver planes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mensajes</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Bandeja de entrada</p>
      </div>
      <MessagesInbox sellerId={user.id} />
    </div>
  );
}
