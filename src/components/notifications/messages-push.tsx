"use client";

import { useEffect } from "react";
import { getPusherClient, subscribePrivate } from "@/lib/pusher/client";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useMessagesNotifications } from "@/store/messages-notifications";

// Tipado mínimo del mensaje para la notificación
type Message = {
  id: string;
  created_at?: string;
  seller_id: string;
  sender_name: string;
  sender_email?: string;
  subject: string;
  body?: string;
};

function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function ensurePermission(): Promise<boolean> {
  if (!supportsNotifications()) return false;
  try {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  } catch {
    return false;
  }
}

function showBrowserNotification(msg: Message) {
  if (!supportsNotifications() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(`Nuevo mensaje de ${msg.sender_name || "Contacto"}`, {
      body: msg.subject || "Has recibido un nuevo mensaje",
    });
    n.onclick = () => {
      window.focus();
      window.location.assign("/dashboard/messages");
    };
    return true;
  } catch {
    return false;
  }
}

export default function MessagesPush({ sellerId }: { sellerId?: string | null }) {
  const pathname = usePathname();
  const { bumpUnread, prependRecent, setUnreadCount, setRecent } = useMessagesNotifications();

  useEffect(() => {
    if (!sellerId) return;

    const client = getPusherClient();
    if (!client) return;

    const channelName = `private-seller-${sellerId}`;
    const ch = subscribePrivate(channelName);
    if (!ch) return;

    const onNew = async (msg: Message) => {
      const onInbox = pathname?.startsWith("/dashboard/messages");
      // Actualizar store: sumar no leídos y agregar a recientes
      prependRecent({
        id: msg.id,
        created_at: msg.created_at,
        seller_id: msg.seller_id,
        sender_name: msg.sender_name,
        subject: msg.subject,
        body: msg.body,
      });
      bumpUnread(1);
      if (onInbox) {
        // En la bandeja, solo toast (no notificación del navegador)
        toast.message("Nuevo mensaje recibido", {
          description: msg.subject || msg.sender_name,
        });
        return;
      }
      const canNotify = await ensurePermission();
      const notified = canNotify ? showBrowserNotification(msg) : false;
      if (!notified) {
        toast.info("Nuevo mensaje recibido", {
          description: msg.subject || msg.sender_name,
          action: {
            label: "Abrir",
            onClick: () => (window.location.href = "/dashboard/messages"),
          },
        });
      }
    };

    const onUpdated = async (_payload: { id: string; status: string }) => {
      try {
        // Recalcular contador y últimas 5 para evitar inconsistencias
        const [unreadRes, recentRes] = await Promise.all([
          fetch(`/api/messages?status=new&pageSize=1`, { cache: "no-store" }),
          fetch(`/api/messages?pageSize=5`, { cache: "no-store" }),
        ]);
        if (unreadRes.ok) {
          const j = await unreadRes.json();
          if (typeof j?.total === "number") setUnreadCount(j.total);
        }
        if (recentRes.ok) {
          const j = await recentRes.json();
          if (Array.isArray(j?.items)) setRecent(j.items);
        }
      } catch {}
    };

    ch.bind("message:new", onNew);
    ch.bind("message:updated", onUpdated);

    return () => {
      try {
        ch.unbind("message:new", onNew);
        ch.unbind("message:updated", onUpdated);
        getPusherClient()?.unsubscribe(channelName);
      } catch {}
    };
  }, [sellerId, pathname]);

  return null;
}
