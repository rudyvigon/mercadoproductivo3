"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Menu, LogOut
} from "lucide-react";
import { MdHomeWork, MdVerified, MdHome, MdInfo, MdCreditCard, MdShoppingBag, MdPhone } from "react-icons/md";
import { BsFillPersonFill } from "react-icons/bs";
import { RiShoppingCart2Fill } from "react-icons/ri";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

// Items de navegación principal
const mainNavItems = [
  { label: "Inicio", href: "/", icon: MdHome },
  { label: "Nosotros", href: "/nosotros", icon: MdInfo },
  { label: "Planes", href: "/planes", icon: MdCreditCard },
  { label: "Marketplace", href: "/marketplace", icon: MdShoppingBag },
  { label: "Contacto", href: "/contacto", icon: MdPhone },
];

// Items de navegación del dashboard
const dashboardNavItems = [
  { label: "Inicio", href: "/dashboard", icon: MdHomeWork },
  { label: "Mi Plan", href: "/dashboard/plan", icon: MdVerified },
  { label: "Mis productos", href: "/dashboard/products", icon: RiShoppingCart2Fill },
  { label: "Perfil", href: "/dashboard/profile", icon: BsFillPersonFill },
];

export default function GlobalMobileMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const pathname = usePathname();
  // Memoizar el cliente para que la identidad sea estable entre renders
  const supabase = useMemo(() => createClient(), []);
  // Ordenar alfabéticamente los items del dashboard (español, sin distinguir mayúsculas/acentos)
  const sortedDashboardItems = useMemo(
    () => [...dashboardNavItems].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })),
    []
  );

  // Verifica si un enlace está activo
  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  // Cargar usuario y escuchar cambios de auth
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

  // Cargar nombre desde perfil
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

    return () => {
      isActive = false;
    };
  }, [supabase, user?.id]);

  // Mostrar texto de bienvenida con nombre del usuario
  const displayName = profileName || 
    (user?.user_metadata?.full_name as string | undefined) || 
    (user?.user_metadata?.name as string | undefined) || 
    "Usuario";

  // Cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = "/";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button 
            size="icon" 
            className="h-12 w-12 rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-[320px] sm:max-w-[400px]">
          <SheetHeader className="pb-4">
            <SheetTitle>
              {user ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage 
                      src={(user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture} 
                      alt={displayName} 
                    />
                    <AvatarFallback>{displayName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {user.email}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-base font-semibold">Mercado Productivo</span>
              )}
            </SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-5">
            {/* Navegación principal para todos los usuarios */}
            <div className="space-y-2">
              <h3 className="px-2 text-xs font-medium uppercase text-muted-foreground tracking-wider">
                Navegación
              </h3>
              <div className="grid gap-2">
                {mainNavItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive(href) 
                        ? "bg-muted text-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Navegación del dashboard si el usuario está autenticado */}
            {user && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="px-2 text-xs font-medium uppercase text-muted-foreground tracking-wider">
                    Dashboard
                  </h3>
                  <div className="grid gap-2">
                    {sortedDashboardItems.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive(href) 
                            ? "bg-muted text-foreground" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon size={16} className="shrink-0" />
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Botones de autenticación */}
            <Separator />
            <div className="px-2 space-y-2">
              {user ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-red-500"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" className="w-full justify-center">
                    <Link href="/auth/login" onClick={() => setOpen(false)}>
                      Iniciar sesión
                    </Link>
                  </Button>
                  <Button asChild className="w-full justify-center bg-orange-500 hover:bg-orange-600">
                    <Link href="/auth/register" onClick={() => setOpen(false)}>
                      Crear cuenta
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
