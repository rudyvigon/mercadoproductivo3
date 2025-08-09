"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;
    // Cargar usuario inicial
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
    });
    // Suscribirse a cambios de auth
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const displayName = useMemo(() => {
    const meta: any = user?.user_metadata || {};
    return (
      meta.name ||
      meta.full_name ||
      meta.username ||
      (user?.email ? String(user.email).split("@")[0] : "Usuario")
    );
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const navItems = [
    { href: "/", label: "Inicio" },
    { href: "/nosotros", label: "Nosotros" },
    { href: "/planes", label: "Planes" },
    { href: "/catalog", label: "Marketplace" },
    { href: "/contacto", label: "Contacto" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  const linkClasses = (active: boolean) =>
    [
      "relative text-sm transition-colors",
      active ? "text-primary" : "text-foreground/80 hover:text-primary",
      // subrayado animado con pseudo-elemento
      "after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-primary after:transition-all after:duration-200",
      active ? "after:w-full" : "hover:after:w-full",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 md:grid md:grid-cols-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-foreground transition-colors hover:text-primary">
            Mercado Productivo
          </Link>
        </div>

        <nav className="hidden items-center justify-center gap-6 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={linkClasses(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center justify-end gap-3 md:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture} alt={displayName} />
                    <AvatarFallback>{displayName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">Bienvenido {displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/dashboard" className="focus:outline-none">
                  <DropdownMenuItem className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/auth/login" className="text-foreground/80 hover:text-foreground">Iniciar sesión</Link>
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:opacity-95"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <button
          className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t md:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-3">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={linkClasses(isActive(item.href))}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-3">
                {user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setOpen(false)} className="text-sm text-foreground/80 hover:text-foreground">
                      Dashboard
                    </Link>
                    <button onClick={() => { setOpen(false); handleSignOut(); }} className="text-sm text-foreground/80 hover:text-foreground">
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={() => setOpen(false)} className="text-sm text-foreground/80 hover:text-foreground">
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/auth/register"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:opacity-95"
                    >
                      Crear cuenta
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
