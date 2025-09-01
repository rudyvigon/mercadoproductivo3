"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContentNoClose, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import ConversationChatInput, { ChatV2Sent } from "./conversation-chat-input";
import { subscribePrivate, getPusherClient } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/chat/delivery";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromTimeline, headerAvatarFromTimeline, avatarAltHeader } from "@/lib/user-display";

export default function SellerConversationWindow({
  open,
  onOpenChange,
  conversationId,
  selfId,
  counterpartyName,
  counterpartyAvatarUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  selfId: string; // id del usuario autenticado (vendedor)
  counterpartyName?: string | null;
  counterpartyAvatarUrl?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [selfEmail, setSelfEmail] = useState<string | null>(null);
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Dedupe de eventos (msg) para evitar duplicados entre onSent y realtime
  const seenRef = useRef<Set<string>>(new Set());
  // Marcado de leído por conversación (solo una vez por apertura)
  const readMarkedRef = useRef<boolean>(false);

  const effectiveConversationId = conversationId;
  const supabase = useMemo(() => createClient(), []);

  // Nombre y avatar efectivos en el header: prioriza el último entrante
  const headerName = useMemo(() => displayNameFromTimeline(timeline, counterpartyName), [timeline, counterpartyName]);
  const headerAvatar = useMemo(() => headerAvatarFromTimeline(timeline, counterpartyAvatarUrl), [timeline, counterpartyAvatarUrl]);

  // Cargar perfil propio para mostrar avatar/nombre en mensajes salientes inmediatos
  useEffect(() => {
    if (!selfId) return;
    let active = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const { data } = await supabase
          .from("profiles")
          .select("full_name,avatar_url")
          .eq("id", selfId)
          .single();
        if (!active) return;
        setSelfName((data?.full_name || "").toString().trim() || null);
        // El email proviene de auth.users para el usuario autenticado
        const authEmail = auth?.user?.id === selfId ? (auth?.user?.email || "") : "";
        setSelfEmail(authEmail.toString().trim() || null);
        setSelfAvatarUrl((data?.avatar_url || "").toString().trim() || null);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [supabase, selfId]);

  // Cargar historial de mensajes de la conversación
  useEffect(() => {
    if (!open || !effectiveConversationId) return;
    async function load() {
      setLoading(true);
      try {
        const url = new URL(`/api/chat/conversations/${effectiveConversationId}/messages`, window.location.origin);
        url.searchParams.set("limit", "50");
        const msgRes = await fetch(url.toString(), { cache: "no-store" });
        const msgData = await msgRes.json();
        if (!msgRes.ok) throw new Error(msgData?.message || msgData?.error || "Error al cargar historial");
        const rows = Array.isArray(msgData?.messages) ? msgData.messages : [];
        const tl: ChatItem[] = rows
          .slice()
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((m: any) => ({
            id: `msg-${m.id}`,
            type: String(m.sender_id) === String(selfId) ? "outgoing" : "incoming",
            message_id: effectiveConversationId,
            body: m.body,
            created_at: m.created_at,
            sender_name: m.sender_name,
            sender_email: m.sender_email,
            avatar_url: m.avatar_url,
          }));
        setTimeline(tl);
        // Sembrar dedupe
        try {
          tl.forEach((it) => seenRef.current.add(it.id));
        } catch {}
        // Scroll al final y marcar leído
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 0);
        try {
          if (!readMarkedRef.current) {
            await markConversationRead(effectiveConversationId);
            readMarkedRef.current = true;
          }
        } catch {}
      } catch (e: any) {
        toast.error(e?.message || "No se pudo cargar el historial");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, effectiveConversationId, selfId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline]);

  // Si timeline cambia por otras razones, asegurar ids dedupe
  useEffect(() => {
    try {
      timeline.forEach((it) => seenRef.current.add(it.id));
    } catch {}
  }, [timeline]);

  // Suscripción realtime a la conversación específica (Chat v2)
  useEffect(() => {
    if (!open || !effectiveConversationId) return;
    const client = getPusherClient();
    if (!client) return;
    const channel = `private-conversation-${effectiveConversationId}`;
    const ch = subscribePrivate(channel);
    if (!ch) return;

    const onChatMessageNew = async (msg: any) => {
      const key = `msg-${msg?.id}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      const isIncoming = String(msg?.sender_id || "") !== String(selfId);
      setTimeline((prev) => {
        const next = prev.concat({
          id: key,
          type: isIncoming ? "incoming" : "outgoing",
          message_id: effectiveConversationId,
          body: msg?.body,
          created_at: msg?.created_at || new Date().toISOString(),
          sender_name: msg?.sender_name ?? (isIncoming ? counterpartyName : selfName) ?? undefined,
          sender_email: msg?.sender_email ?? (isIncoming ? undefined : selfEmail) ?? undefined,
          avatar_url: msg?.avatar_url ?? (isIncoming ? counterpartyAvatarUrl : selfAvatarUrl) ?? undefined,
        });
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      // Marcar leído si es entrante
      try {
        if (isIncoming && !readMarkedRef.current) {
          await markConversationRead(effectiveConversationId);
          readMarkedRef.current = true;
        }
      } catch {}
    };

    ch.bind("chat:message:new", onChatMessageNew);
    return () => {
      ch.unbind("chat:message:new", onChatMessageNew);
      getPusherClient()?.unsubscribe(channel);
    };
  }, [open, effectiveConversationId, selfId]);

  function handleSent(evt: ChatV2Sent) {
    const key = `msg-${evt.id}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    setTimeline((prev) => {
      const next = prev.concat({
        id: key,
        type: "outgoing",
        message_id: evt.message_id,
        body: evt.body,
        created_at: evt.created_at,
        sender_name: selfName || undefined,
        sender_email: selfEmail || undefined,
        avatar_url: selfAvatarUrl || undefined,
      });
      return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoClose className="flex h-[85vh] w-[96vw] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b p-4">
          {/* Solapa superior para gesto de cerrar en mobile */}
          <div
            className="sm:hidden mx-auto mb-2 mt-1 h-1.5 w-12 rounded-full bg-muted"
            onTouchStart={(e) => {
              try { (e.currentTarget as any)._startY = e.touches?.[0]?.clientY ?? 0; (e.currentTarget as any)._deltaY = 0; } catch {}
            }}
            onTouchMove={(e) => {
              try {
                const startY = (e.currentTarget as any)._startY ?? null;
                if (startY == null) return;
                const y = e.touches?.[0]?.clientY ?? startY;
                (e.currentTarget as any)._deltaY = y - startY;
              } catch {}
            }}
            onTouchEnd={(e) => {
              try {
                const dy = (e.currentTarget as any)._deltaY ?? 0;
                if (dy > 60) onOpenChange(false);
                (e.currentTarget as any)._startY = null;
                (e.currentTarget as any)._deltaY = 0;
              } catch {}
            }}
          />
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={headerAvatar} alt={avatarAltHeader(headerName)} />
              <AvatarFallback>{(((headerName || "U")[0]) || "U").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">{headerName || ""}</DialogTitle>
              <DialogDescription className="truncate">Conversación</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn("flex min-h-0 flex-1 flex-col")}> 
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Cargando...</div>
            ) : timeline.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No hay mensajes en esta conversación.</div>
            ) : (
              <ChatMessages items={timeline} />
            )}
          </div>
          <div className="border-t p-3">
            <ConversationChatInput conversationId={effectiveConversationId} onSent={handleSent} />
          </div>
        </div>
      </DialogContentNoClose>
    </Dialog>
  );
}
