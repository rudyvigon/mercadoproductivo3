import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams?: Record<string, string | string[] | undefined> };

function getParam(v: string | string[] | undefined) {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

export default function SuccessPage({ searchParams }: Props) {
  const free = getParam(searchParams?.free);
  const scheduled = getParam(searchParams?.scheduled);

  let title = "Suscripción iniciada";
  let desc = "Si completaste el pago, aplicaremos el cambio al cierre de tu ciclo actual.";
  if (free) {
    title = "Plan gratuito activado";
    desc = "Tu plan se activó correctamente.";
  } else if (scheduled) {
    title = "Cambio de plan programado";
    desc = "Aplicaremos el cambio al cierre de tu ciclo actual.";
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button asChild>
            <Link href="/dashboard/plan">Volver a Mi Plan</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
