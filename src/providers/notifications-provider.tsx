"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoleFromMetadata } from "@/lib/auth/role";
import MessagesPush from "@/components/notifications/messages-push";
import { useMessagesNotifications } from "@/store/messages-notifications";

export type NotificationsContextValue = ReturnType<typeof useMessagesNotifications>;

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  const store = useMessagesNotifications();
  // Si el Provider no está montado por alguna razón, usar el store directamente
  return ctx ?? store;
}

export default function NotificationsProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);

  // Cargar usuario y escuchar cambios de auth
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      if (subscription) {
        // unsubscribe no debería lanzar; evitamos catch vacío para cumplir no-empty
        subscription.unsubscribe();
      }
    };
  }, [supabase]);

  // Derivar href de mensajes según rol
  const messagesHref = useMemo(() => {
    const role = normalizeRoleFromMetadata(user?.user_metadata || {});
    const isSeller = role === "seller";
    return isSeller ? "/dashboard/messages" : "/mensajes";
  }, [user]);

  // Estado y acciones desde el store existente
  const store = useMessagesNotifications();

  return (
    <NotificationsContext.Provider value={store}>
      {children}
      {/* Montar una sola vez la suscripción de Pusher para toda la app */}
      {user ? (
        <MessagesPush sellerId={user.id} messagesHref={messagesHref} />
      ) : null}
    </NotificationsContext.Provider>
  );
}

