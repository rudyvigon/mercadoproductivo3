"use client";

import { useEffect, useCallback } from "react";
import { getPusherClient, subscribePrivate } from "@/lib/pusher/client";
import { useMessagesNotifications } from "@/store/messages-notifications";
import { toast } from "sonner";

export default function MessagesPush({ sellerId, messagesHref }: { sellerId?: string | null; messagesHref?: string }) {
  const { setUnreadCount, setRecent } = useMessagesNotifications();

  // Snapshot de inbox Chat v2: total no leídos y últimos 5
  const refreshInboxSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/conversations`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const list: any[] = Array.isArray(j?.conversations) ? j.conversations : [];
      // Calcular no leídos (solo conversaciones visibles, consistente con messages-inbox-v2)
      const unread = list
        .filter((it: any) => !it?.hidden_at)
        .reduce((acc, it: any) => acc + (Number(it?.unread_count || 0) || 0), 0);
      setUnreadCount(unread);
      // Mapear recientes (top 5 por última actividad)
      const ts = (it: any) =>
        String(it?.last_created_at || it?.last_at || it?.updated_at || it?.created_at || "");
      const getText = (it: any) =>
        String(
          it?.preview || it?.last_subject || it?.last_message || it?.last_body || it?.topic || "Nueva actividad"
        );
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
      // ignorar errores de red/auth
    }
  }, [setUnreadCount, setRecent]);

  useEffect(() => {
    if (!sellerId) return;

    const client = getPusherClient();
    if (!client) return;

    // Chat v2: canal por usuario autenticado
    const channelName = `private-user-${sellerId}`;
    const ch = subscribePrivate(channelName);
    if (!ch) return;

    // Eventos Chat v2 relevantes en canal de usuario
    const onConvUpdated = async (evt: any) => {
      await refreshInboxSnapshot();
      // Mostrar toast con el nombre del remitente/conversación y permitir clic para ir a mensajes
      try {
        const convId = String(evt?.conversation_id || "");
        if (!convId) return;
        const res = await fetch(`/api/chat/conversations?includeHidden=true`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const list: any[] = Array.isArray(j?.conversations) ? j.conversations : [];
        const conv = list.find((c: any) => String(c?.id || c?.conversation_id) === convId);
        const name =
          String(conv?.counterparty_name || conv?.title || conv?.topic || "Usuario").trim() || "Usuario";
        const preview = String(
          conv?.preview || conv?.last_subject || conv?.last_message || conv?.last_body || "Nuevo mensaje"
        );
        toast(`Tienes un mensaje nuevo`, {
          description: preview,
          duration: 4500,
          action: {
            label: "Ver mensajes",
            onClick: () => {
              try {
                window.location.href = messagesHref || "/dashboard/messages";
              } catch {}
            },
          },
        });
      } catch {
        // ignorar errores del toast
      }
    };
    const onConvStarted = async (_evt: any) => {
      await refreshInboxSnapshot();
    };
    const onConvHidden = async (_evt: any) => {
      await refreshInboxSnapshot();
    };
    const onConvRestored = async (_evt: any) => {
      await refreshInboxSnapshot();
    };
    const onConvRead = async (_evt: any) => {
      await refreshInboxSnapshot();
    };

    ch.bind("chat:conversation:updated", onConvUpdated);
    ch.bind("chat:conversation:started", onConvStarted);
    ch.bind("chat:conversation:hidden", onConvHidden);
    ch.bind("chat:conversation:restored", onConvRestored);
    ch.bind("chat:conversation:read", onConvRead);

    return () => {
      try {
        ch.unbind("chat:conversation:updated", onConvUpdated);
        ch.unbind("chat:conversation:started", onConvStarted);
        ch.unbind("chat:conversation:hidden", onConvHidden);
        ch.unbind("chat:conversation:restored", onConvRestored);
        ch.unbind("chat:conversation:read", onConvRead);
        getPusherClient()?.unsubscribe(channelName);
      } catch {}
    };
  }, [sellerId, refreshInboxSnapshot, setUnreadCount, setRecent]);

  // Re-sincronizar cuando la pestaña vuelva a estar activa
  useEffect(() => {
    const onVis = () => {
      try {
        if (document.visibilityState === "visible") refreshInboxSnapshot();
      } catch {}
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshInboxSnapshot]);

  return null;
}

