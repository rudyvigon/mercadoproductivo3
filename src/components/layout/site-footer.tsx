import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-sky-900 text-white pb-safe">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-semibold">Mercado Productivo</h4>
            <p className="mt-2 text-sm text-white/80">
              Conexiones B2B agroindustriales con foco en transparencia y contacto directo.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Enlaces útiles</h4>
            <ul className="mt-2 space-y-2 text-sm text-white/80">
              <li><Link href="/contacto" className="hover:text-white">Contacto</Link></li>
              <li><Link href="/nosotros" className="hover:text-white">Nosotros</Link></li>
             
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Compañía</h4>
            <ul className="mt-2 space-y-2 text-sm text-white/80">
              <li><Link href="/" className="hover:text-white">Marketplace</Link></li>
              <li><Link href="/planes" className="hover:text-white">Planes</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} Mercado Productivo. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/terminos" className="hover:text-white">Términos</Link>
            <Link href="/privacidad" className="hover:text-white">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
