"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MessagesInboxV2 from "@/components/messages/messages-inbox-v2";



export default function BuyerMessagesInbox() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUserId(data.user?.id ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  if (loading) return <div className="p-3 text-sm text-muted-foreground">Cargando...</div>;
  if (!userId) return <div className="p-3 text-sm text-muted-foreground">Debes iniciar sesión para ver tus mensajes.</div>;
  return <MessagesInboxV2 userId={userId} />;
}
