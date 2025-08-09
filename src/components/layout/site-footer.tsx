import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-sky-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-semibold">Mercado Productivo</h4>
            <p className="mt-2 text-sm text-white/80">
              Conexiones B2B agroindustriales con foco en transparencia y contacto directo.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Producto</h4>
            <ul className="mt-2 space-y-2 text-sm text-white/80">
              <li><Link href="/#how-it-works" className="hover:text-white">Cómo funciona</Link></li>
              <li><Link href="/#benefits" className="hover:text-white">Beneficios</Link></li>
              <li><Link href="/#categories" className="hover:text-white">Categorías</Link></li>
              <li><Link href="/#plans" className="hover:text-white">Planes</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Compañía</h4>
            <ul className="mt-2 space-y-2 text-sm text-white/80">
              <li><Link href="/about" className="hover:text-white">Acerca de</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Precios</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contacto</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} Mercado Productivo. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/legal/terminos" className="hover:text-white">Términos</Link>
            <Link href="/legal/privacidad" className="hover:text-white">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
