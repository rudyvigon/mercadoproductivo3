"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/providers/notifications-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MessagesBell() {
  const { unreadCount, recent } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notificaciones de mensajes"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted focus:outline-none"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500" />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
              {unreadCount} sin leer
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sin nuevas</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No hay notificaciones recientes</div>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {recent.map((m) => (
              <DropdownMenuItem key={m.id} className="flex flex-col items-start gap-0.5 py-2">
                <div className="w-full truncate text-sm font-medium">{m.sender_name || "—"}</div>
                <div className="w-full truncate text-xs text-muted-foreground">{m.subject || "Nuevo mensaje"}</div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <Link href="/dashboard/messages" className="block">
          <DropdownMenuItem className="justify-center text-primary">Ver todos</DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

