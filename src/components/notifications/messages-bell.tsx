"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { useMessagesNotifications } from "@/store/messages-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MessagesBell() {
  const { unreadCount, recent, setUnreadCount, setRecent } = useMessagesNotifications();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/chat/conversations`, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) return;
        const j = await res.json();
        const list: any[] = Array.isArray(j?.conversations) ? j.conversations : [];
        // no leídos totales
        const unread = list.reduce((acc, it: any) => acc + (Number(it?.unread_count || 0) || 0), 0);
        setUnreadCount(unread);
        // recientes (top 5)
        const ts = (it: any) => String(it?.last_created_at || it?.last_at || it?.updated_at || it?.created_at || "");
        const getText = (it: any) =>
          String(it?.preview || it?.last_subject || it?.last_message || it?.last_body || it?.topic || "Nueva actividad");
        const getName = (it: any) => String(it?.counterparty_name || it?.title || it?.topic || "—");
        const recentItems = [...list]
          .sort((a, b) => new Date(ts(b)).getTime() - new Date(ts(a)).getTime())
          .slice(0, 5)
          .map((c: any) => ({
            id: String(c?.id || c?.conversation_id || `${ts(c)}-${Math.random().toString(36).slice(2)}`),
            created_at: ts(c),
            seller_id: String(c?.owner_id || c?.user_id || ""),
            sender_name: getName(c),
            subject: getText(c),
            body: undefined as string | undefined,
          }));
        setRecent(recentItems);
      } catch {
        // ignore network/auth errors
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [setUnreadCount, setRecent]);

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

