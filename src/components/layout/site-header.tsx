"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeRoleFromMetadata } from "@/lib/auth/role";
import { MenuActionButton } from "@/components/ui/menu-buttons";
import { useNotifications } from "@/providers/notifications-provider";
 

export default function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileCompany, setProfileCompany] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const { unreadCount } = useNotifications();
  const [accountOpen, setAccountOpen] = useState(false);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserLoading(false);
    });
    return () => {
      mounted = false;
      try {
        subscription?.unsubscribe();
      } catch {}
    };
  }, [supabase]);

  // Cargar nombre y empresa desde perfil y suscribirse a cambios
  useEffect(() => {
    if (!user?.id) {
      setProfileName(null);
      setProfileCompany(null);
      return;
    }
    let isActive = true;

    async function loadProfileName() {
      const { data } = await supabase
        .from("profiles")
        .select("company, full_name, first_name, last_name")
        .eq("id", user.id)
        .single();
      if (!isActive) return;
      const name = (data?.full_name || `${data?.first_name ?? ""} ${data?.last_name ?? ""}`)
        .toString()
        .trim();
      setProfileName(name || null);
      const company = String((data as any)?.company || "").trim();
      setProfileCompany(company || null);
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
          const company = String(row.company || "").trim();
          setProfileCompany(company || null);
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
      if (typeof detail.company === "string") {
        const company = String(detail.company).trim();
        setProfileCompany(company || null);
      }
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

  // Para la tarjeta del menú: primero empresa, luego nombre completo
  const companyOrName = useMemo(() => {
    const c = String(profileCompany || "").trim();
    return c || displayName;
  }, [profileCompany, displayName]);

  // Si cambia la metadata del usuario (updateUser), reflejarlo también
  useEffect(() => {
    const meta: any = user?.user_metadata || {};
    const name = (meta.full_name || `${meta.first_name ?? ""} ${meta.last_name ?? ""}`)
      .toString()
      .trim();
    if (name) setProfileName(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_metadata?.full_name, user?.user_metadata?.first_name, user?.user_metadata?.last_name]);

  // Rol normalizado reutilizando utilidad centralizada
  const role = normalizeRoleFromMetadata(user?.user_metadata || {});
  const isSeller = role === "seller";
  const accountHref = isSeller ? "/dashboard" : "/profile";
  const accountLabel = isSeller ? "Dashboard" : "Perfil";
  const messagesHref = isSeller ? "/dashboard/messages" : "/mensajes";
  const onMessagesPage = useMemo(() => {
    try {
      return pathname?.startsWith(messagesHref);
    } catch {
      return false;
    }
  }, [pathname, messagesHref]);

  // Badge rojo: mostrar si hay no leídos (estado provisto por NotificationsProvider)

  async function handleSignOut() {
    // Cerrar menú antes de desloguear
    try { setAccountOpen(false); } catch {}
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const navItems = [
    { href: "/", label: "Productos" },
    { href: "/vendedores", label: "Vendedores" },
    { href: "/exportadores", label: "Exportadores" },
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
    <header className="fixed top-0 left-0 right-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pt-safe pr-safe pl-safe">
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
          {isSeller ? (
            <Link
              href="/dashboard/services/new"
              aria-current={isActive("/dashboard/services/new") ? "page" : undefined}
              className={linkClasses(isActive("/dashboard/services/new"))}
            >
              Cargar servicio
            </Link>
          ) : null}
        </nav>

        <div className="hidden items-center justify-end gap-2 sm:gap-3 lg:flex">
          {userLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full sm:h-8 sm:w-8" />
              <Skeleton className="hidden h-4 w-20 sm:w-24 md:block" />
            </div>
          ) : user ? (
            <>
              {/* Ícono de mensajes con badge rojo (con accesibilidad) */}
              <Link href={messagesHref} aria-label="Mensajes">
                <button
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f06d04]/10"
                  aria-label={unreadCount > 0 ? `Mensajes, ${unreadCount} sin leer` : "Mensajes"}
                >
                  <MessageSquare className="h-5 w-5" />
                  {/* Región para lectores de pantalla que anuncia cambios de contador */}
                  <span className="sr-only" aria-live="polite" aria-atomic="true">
                    {unreadCount > 0 ? `${unreadCount} mensajes sin leer` : `Sin mensajes nuevos`}
                  </span>
                  {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 rounded-full bg-red-500" />
                  ) : null}
                </button>
              </Link>

              <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[#f06d04]/10 sm:gap-2">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                      <AvatarImage src={(user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture} alt={displayName} />
                      <AvatarFallback>{displayName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-xs font-medium sm:text-sm md:inline">{displayName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 rounded-3xl p-0 sm:w-96"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {/* Tarjeta personalizada */}
                  <div className="rounded-3xl bg-muted/40 p-6 text-center">
                    {/* Avatar/logo */}
                    <div className="mx-auto mb-4 flex items-center justify-center">
                      <Avatar className="h-16 w-16 ring-2 ring-white/40">
                        <AvatarImage src={(user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture} alt={displayName} />
                        <AvatarFallback className="text-lg">{displayName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Bienvenida y nombre empresa o usuario */}
                    <div className="space-y-1">
                      <p className="text-xs tracking-[0.35em] text-foreground/70">BIENVENIDO</p>
                      <p className="truncate text-base font-semibold tracking-widest text-foreground">{companyOrName}</p>
                    </div>

                    {/* Acciones */}
                    <div className="mt-5 flex items-center justify-center gap-4">
                      {/* Botón MENSAJES (estilo ancla de referencia) */}
                      <Link
                        href={messagesHref}
                        className="focus:outline-none"
                        onClick={() => setAccountOpen(false)}
                      >
                        <MenuActionButton>
                          Mensajes
                        </MenuActionButton>
                      </Link>

                      {/* Botón DASHBOARD/PERFIL (mismo estilo referencia) */}
                      <Link
                        href={accountHref}
                        className="focus:outline-none"
                        onClick={() => setAccountOpen(false)}
                      >
                        <MenuActionButton aria-label={accountLabel}>
                          {accountLabel}
                        </MenuActionButton>
                      </Link>
                    </div>

                    {/* Cerrar sesión */}
                    <button
                      onClick={handleSignOut}
                      className="mx-auto mt-6 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium tracking-[0.2em] text-foreground/80 transition-colors hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" /> CERRAR SESIÓN
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
          </>
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
