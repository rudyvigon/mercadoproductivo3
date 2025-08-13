import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Planes de Suscripción | Mercado Productivo",
  description: "Planes flexibles para emprendedores, PyMEs y empresas. Elige el plan perfecto para tu negocio.",
};

export default function PlanesPage() {
  return (
    <main className="mx-auto max-w-6xl p-4 space-y-6 sm:p-6 sm:space-y-8">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Planes y Precios</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Planes flexibles diseñados para crecer contigo. Desde emprendedores hasta grandes empresas,
          tenemos la solución perfecta para tus necesidades.
        </p>
      </section>

      {/* Plans */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Básico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Básico</CardTitle>
            <CardDescription>Perfecto para comenzar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Gratis</div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">Incluye:</p>
              <ul className="list-inside space-y-1 text-muted-foreground">
                <li>• 5 productos máximo</li>
                <li>• 1 imagen por producto</li>
                <li>• Soporte por email</li>
                <li>• Búsqueda básica</li>
                <li>• Perfil básico</li>
              </ul>
              <p className="mt-4 font-medium">Limitaciones:</p>
              <ul className="list-inside space-y-1 text-muted-foreground">
                <li>• Sin créditos mensuales</li>
                <li>• Prioridad baja en búsquedas</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard">Comenzar Gratis</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Premium - Más Popular */}
        <Card className="relative overflow-hidden border-primary/40 shadow-lg shadow-primary/5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="px-3 py-1" variant="default">Más Popular</Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-xl">Premium</CardTitle>
            <CardDescription>Ideal para pequeños negocios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$29/mes</div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">Incluye:</p>
              <ul className="list-inside space-y-1 text-muted-foreground">
                <li>• 50 productos máximo</li>
                <li>• 5 imágenes por producto</li>
                <li>• 100 créditos mensuales</li>
                <li>• Prioridad media en búsquedas</li>
                <li>• Analytics avanzados</li>
                <li>• Soporte por email y chat</li>
                <li>• SLA 99.5%</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full" variant="default">
              <Link href="/dashboard">Elegir Premium</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Plus */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Plus</CardTitle>
            <CardDescription>Para negocios en crecimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$79/mes</div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">Incluye:</p>
              <ul className="list-inside space-y-1 text-muted-foreground">
                <li>• Productos ilimitados</li>
                <li>• 10 imágenes por producto</li>
                <li>• 500 créditos mensuales</li>
                <li>• Prioridad alta en búsquedas</li>
                <li>• Analytics premium</li>
                <li>• Soporte prioritario</li>
                <li>• API completa</li>
                <li>• SLA 99.9%</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full" variant="outline">
              <Link href="/dashboard">Elegir Plus</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* FAQ */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">Preguntas Frecuentes</h2>
        <p className="mt-2 text-muted-foreground">Resolvemos las dudas más comunes sobre nuestros planes y servicios.</p>
        <Accordion type="single" collapsible className="mt-6">
          <AccordionItem value="q1">
            <AccordionTrigger>¿Puedo cambiar de plan en cualquier momento?</AccordionTrigger>
            <AccordionContent>
              Sí, puedes actualizar o degradar tu plan en cualquier momento desde tu panel de control. Los cambios se
              aplicarán en tu próximo ciclo de facturación.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger>¿Qué son los créditos mensuales?</AccordionTrigger>
            <AccordionContent>
              Los créditos te permiten destacar tus productos, aparecer en búsquedas prioritarias y acceder a funciones
              premium. Se renuevan cada mes según tu plan.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger>¿Hay descuentos por pago anual?</AccordionTrigger>
            <AccordionContent>
              Sí, ofrecemos un 20% de descuento en todos los planes pagados anualmente. Contacta a nuestro equipo de
              ventas para más información.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger>¿Puedo cancelar mi suscripción?</AccordionTrigger>
            <AccordionContent>
              Por supuesto. Puedes cancelar tu suscripción en cualquier momento desde tu panel de control. Mantendrás
              acceso a las funciones premium hasta el final de tu período de facturación actual.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* CTA Final */}
      <section className="mx-auto mt-16 max-w-3xl rounded-xl border bg-muted/30 p-8 text-center">
        <h3 className="text-2xl font-semibold">¿Listo para hacer crecer tu negocio?</h3>
        <p className="mt-2 text-muted-foreground">
          Únete a miles de emprendedores que ya están vendiendo más con Mercado Productivo.
        </p>
        <div className="mt-3 flex items-baseline justify-center gap-x-2 sm:mt-4 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Comenzar Gratis</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacto">Hablar con Ventas</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
