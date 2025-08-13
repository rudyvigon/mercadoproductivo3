"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, LayoutDashboard, Package, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const items = [
  {
    label: "Panel",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Mi Plan",
    href: "/dashboard/plan",
    icon: CheckCircle2,
  },
  {
    label: "Mis productos",
    href: "/dashboard/products",
    icon: Package,
  },
  {
    label: "Perfil",
    href: "/dashboard/profile",
    icon: User,
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

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-6">
      <div className="px-2 pb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Menú</p>
      </div>
      <nav className="grid gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(href);
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
              <Icon size={16} className="shrink-0" />
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
