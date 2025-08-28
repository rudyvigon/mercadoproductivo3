"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, LayoutDashboard, Package, User, Menu, X, HomeIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MdHomeWork } from "react-icons/md";
import { MdVerified } from "react-icons/md";
import { MdOutlineShoppingCart } from "react-icons/md";
import { BsFillPersonFill } from "react-icons/bs";
import { RiShoppingCart2Fill } from "react-icons/ri";
import { useMessagesNotifications } from "@/store/messages-notifications";


const items = [
  {
    label: "Inicio ",
    href: "/dashboard",
    icon: MdHomeWork,
  },
  {
    label: "Mi Plan",
    href: "/dashboard/plan",
    icon: MdVerified,
  },
  {
    label: "Mis productos",
    href: "/dashboard/products",
    icon: RiShoppingCart2Fill ,
  },
  {
    label: "Perfil",
    href: "/dashboard/profile",
    icon: BsFillPersonFill ,
  },
  {
    label: "Mensajes",
    href: "/dashboard/messages",
    icon: MessageSquare,
  },
] as const;

// Hook para detectar si el sidebar móvil debe estar visible
export function useMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  return { isOpen, setIsOpen };
}

// Componente de navegación interna
function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { unreadCount } = useMessagesNotifications();
  // Orden alfabético por etiqueta, en español y sin distinguir mayúsculas/acentos
  const navItems = [...items].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-6">
      <div className="px-2 pb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Menú</p>
      </div>
      <nav className="grid gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(href);
          const showUnreadDot = href === "/dashboard/messages" && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon size={16} className="shrink-0" />
                {showUnreadDot && (
                  <span className="absolute -right-1 -top-1 inline-flex h-2 w-2 rounded-full bg-red-500" />
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function DashboardSidebar() {
  return (
    /* Sidebar solo para desktop - móvil usa el menú global */
    <aside className="hidden lg:flex lg:flex-col border-r bg-card/50 w-64">
      <div className="sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center justify-center p-4 border-b">
          <h2 className="text-lg font-semibold">Dashboard</h2>
        </div>
        <SidebarNav />
      </div>
    </aside>
  );
}
