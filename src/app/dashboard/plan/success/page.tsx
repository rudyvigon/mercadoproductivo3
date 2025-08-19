import Link from "next/link";
import { headers } from "next/headers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getParam(v: string | string[] | undefined) {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

type Props = { searchParams?: Record<string, string | string[] | undefined> };

export default async function SuccessPage({ searchParams }: Props) {
  const preapprovalId = getParam(searchParams?.preapproval_id) || getParam(searchParams?.id);
  const created = getParam(searchParams?.created) === "1";
  const scheduled = getParam(searchParams?.scheduled) === "1";
  const already = getParam(searchParams?.already) === "1";
  const free = getParam(searchParams?.free) === "1";
  const effectiveAt = getParam(searchParams?.effective_at);

  // Disparar procesamiento del preapproval en nuestro backend (idempotente)
  if (preapprovalId) {
    const baseUrl = getBaseUrl();
    try {
      await fetch(`${baseUrl}/api/webhooks/mercadopago?id=${encodeURIComponent(preapprovalId)}`, {
        method: "GET",
        cache: "no-store",
      });
    } catch {
      // Ignorar: el webhook real de MP actualizará el estado igualmente
    }
  }

  let description: JSX.Element | string = "Suscripción completada correctamente.";
  if (free) description = "Tu plan gratuito fue activado exitosamente.";
  else if (created) description = "Suscripción creada. En breve se confirmará y se actualizará tu plan.";
  else if (scheduled) description = effectiveAt
    ? `Cambio de plan programado para ${new Date(effectiveAt).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}.`
    : "Cambio de plan programado para el próximo ciclo.";
  else if (already) description = "Ya estabas suscripto a este plan.";

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>¡Suscripción iniciada!</CardTitle>
          <CardDescription>
            {description}
            {preapprovalId ? (
              <>
                <br />ID de autorización: <b>{preapprovalId}</b>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 justify-end">
          <Button asChild variant="secondary">
            <Link href="/dashboard/plan">Ir a Mi Plan</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
