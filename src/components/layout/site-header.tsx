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
import { Skeleton } from "@/components/ui/skeleton";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;
    // Cargar usuario inicial
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
    }).finally(() => {
      if (mounted) setUserLoading(false);
    });
    // Suscribirse a cambios de auth
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Cargar nombre desde perfil y suscribirse a cambios
  useEffect(() => {
    if (!user?.id) {
      setProfileName(null);
      return;
    }
    let isActive = true;

    async function loadProfileName() {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", user.id)
        .single();
      if (!isActive) return;
      const name = (data?.full_name || `${data?.first_name ?? ""} ${data?.last_name ?? ""}`)
        .toString()
        .trim();
      setProfileName(name || null);
    }

    loadProfileName();

    const channel = supabase
      .channel("profiles-fullname")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload: any) => {
          const row: any = payload.new || {};
          const name = (row.full_name || `${row.first_name ?? ""} ${row.last_name ?? ""}`)
            .toString()
            .trim();
          setProfileName(name || null);
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      // limpiar canal
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [supabase, user?.id]);

  // Escuchar evento local para refrescar el nombre inmediatamente tras guardar
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const detail: any = e.detail || {};
      const name = (detail.full_name || `${detail.first_name ?? ""} ${detail.last_name ?? ""}`)
        .toString()
        .trim();
      if (name) setProfileName(name);
    };
    // @ts-ignore - CustomEvent typing
    window.addEventListener("profile:updated", handler as any);
    return () => {
      // @ts-ignore - CustomEvent typing
      window.removeEventListener("profile:updated", handler as any);
    };
  }, []);

  const displayName = useMemo(() => {
    const meta: any = user?.user_metadata || {};
    return (
      profileName ||
      meta.name ||
      meta.full_name ||
      meta.username ||
      (user?.email ? String(user.email).split("@")[0] : "Usuario")
    );
  }, [user, profileName]);

  // Si cambia la metadata del usuario (updateUser), reflejarlo también
  useEffect(() => {
    const meta: any = user?.user_metadata || {};
    const name = (meta.full_name || `${meta.first_name ?? ""} ${meta.last_name ?? ""}`)
      .toString()
      .trim();
    if (name) setProfileName(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_metadata?.full_name, user?.user_metadata?.first_name, user?.user_metadata?.last_name]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const navItems = [
    { href: "/", label: "Marketplace" },
    { href: "/vendedores", label: "Vendedores" },
    { href: "/nosotros", label: "Nosotros" },
    { href: "/planes", label: "Planes" },
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
    <header className="fixed top-0 left-0 right-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:grid lg:grid-cols-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-foreground transition-colors hover:text-primary">
            Mercado Productivo
          </Link>
        </div>

        <nav className="hidden items-center justify-center gap-4 text-sm font-medium lg:flex lg:gap-6">
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

        <div className="hidden items-center justify-end gap-2 sm:gap-3 lg:flex">
          {userLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full sm:h-8 sm:w-8" />
              <Skeleton className="hidden h-4 w-20 sm:w-24 md:block" />
            </div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[#f06d04]/10 sm:gap-2">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarImage src={(user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture} alt={displayName} />
                    <AvatarFallback>{displayName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs font-medium sm:text-sm md:inline">{displayName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 sm:w-56">
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
              <Link href="/auth/login" className="text-xs text-foreground/80 hover:text-foreground sm:text-sm">Iniciar sesión</Link>
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:opacity-95"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        {/* Botón de menú móvil eliminado - reemplazado por menú hamburguesa global */}
      </div>

      {/* Menú móvil expandido eliminado - reemplazado por menú hamburguesa global */}
    </header>
  );
}
