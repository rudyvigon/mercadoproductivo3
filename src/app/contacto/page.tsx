import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ContactForm from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contacto | Mercado Productivo",
  description: "Ponte en contacto con el equipo de Mercado Productivo",
};

export default function ContactoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contacto</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground sm:text-base">
          ¿Tienes consultas o necesitas ayuda? Escríbenos y te responderemos a la brevedad.
        </p>
      </div>

      {/* Info + Formulario */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Información de contacto */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
              <CardDescription>Comunícate con nuestro equipo por los siguientes medios.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-primary" /> Email</div>
                <div className="text-sm">
                  <p><a href="mailto:info@mercadoproductivo.com" className="underline hover:text-primary">info@mercadoproductivo.com</a></p>
                  <p><a href="mailto:soporte@mercadoproductivo.com" className="underline hover:text-primary">soporte@mercadoproductivo.com</a></p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4 text-primary" /> Teléfono</div>
                <div className="text-sm">
                  <p><a href="tel:+541112345678" className="hover:text-primary">+54 11 1234-5678</a></p>
                  <p><a href="tel:+541187654321" className="hover:text-primary">+54 11 8765-4321</a></p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4 text-primary" /> Dirección</div>
                <div className="text-sm">
                  <p>Av. Corrientes 1234, Piso 5</p>
                  <p>Buenos Aires, Argentina (C1043AAZ)</p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4 text-primary" /> Horarios de Atención</div>
                <div className="text-sm">
                  <p>Lunes a Viernes: 9:00 - 18:00</p>
                  <p>Sábados: 9:00 - 14:00</p>
                  <p>Domingos: Cerrado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Redes sociales */}
          <Card>
            <CardHeader>
              <CardTitle>Síguenos en Redes Sociales</CardTitle>
              <CardDescription>Últimas novedades y oportunidades del mercado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {[
                  { href: "#", title: "Facebook", icon: Facebook },
                  { href: "#", title: "Twitter", icon: Twitter },
                  { href: "#", title: "Instagram", icon: Instagram },
                  { href: "#", title: "LinkedIn", icon: Linkedin },
                ].map((s) => (
                  <a
                    key={s.title}
                    href={s.href}
                    aria-label={s.title}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <span className="sr-only">{s.title}</span>
                    <s.icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Envíanos un Mensaje</CardTitle>
            <CardDescription>Completa el formulario y te contactaremos a la brevedad.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
