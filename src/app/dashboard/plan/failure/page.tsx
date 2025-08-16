import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams?: Record<string, string | string[] | undefined> };

function getParam(v: string | string[] | undefined) {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

export default function FailurePage({ searchParams }: Props) {
  const error = getParam(searchParams?.error) || "ERROR";
  const message = (error || "").toString().replace(/[_-]/g, " ");

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Error en la suscripción</CardTitle>
          <CardDescription>Ocurrió un problema: {message}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 justify-end">
          <Button asChild variant="secondary">
            <Link href="/dashboard/plan">Volver a Mi Plan</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/plan">Reintentar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
