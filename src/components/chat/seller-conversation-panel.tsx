"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import ConversationChatInput, { ChatV2Sent } from "./conversation-chat-input";
import { subscribePrivate, getPusherClient } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/chat/delivery";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromTimeline, headerAvatarFromTimeline, avatarAltHeader } from "@/lib/user-display";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import confirmModal from "@/components/ui/confirm-modal";
import { MoreVertical, CheckCheck } from "lucide-react";

export default function SellerConversationPanel({
  conversationId,
  selfId,
  counterpartyName,
  counterpartyAvatarUrl,
  onConversationRead,
}: {
  conversationId: string;
  selfId: string;
  counterpartyName?: string | null;
  counterpartyAvatarUrl?: string | null;
  onConversationRead?: (conversationId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [selfEmail, setSelfEmail] = useState<string | null>(null);
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const readDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markingReadRef = useRef<boolean>(false);

  const effectiveConversationId = conversationId;
  const supabase = useMemo(() => createClient(), []);

  const headerName = useMemo(() => displayNameFromTimeline(timeline, counterpartyName), [timeline, counterpartyName]);
  const headerAvatar = useMemo(() => headerAvatarFromTimeline(timeline, counterpartyAvatarUrl), [timeline, counterpartyAvatarUrl]);

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
        const authEmail = auth?.user?.id === selfId ? (auth?.user?.email || "") : "";
        setSelfEmail(authEmail.toString().trim() || null);
        setSelfAvatarUrl((data?.avatar_url || "").toString().trim() || null);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [supabase, selfId]);

  // Marcar conversación como leída
  const markAsRead = async () => {
    if (!effectiveConversationId) return;
    if (markingReadRef.current) return;
    try {
      markingReadRef.current = true;
      await markConversationRead(effectiveConversationId);
      // Forzar actualización del estado para reflejar el cambio
      setTimeline((prev) => [...prev]);
      try {
        onConversationRead?.(effectiveConversationId);
      } catch {}
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    } finally {
      markingReadRef.current = false;
    }
  };
  
  // Marcar automáticamente como leído cuando se monta el componente
  useEffect(() => {
    markAsRead();
    // También marcar como leído cuando el componente se desmonte
    return () => {
      if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
      markAsRead();
    };
  }, [effectiveConversationId]);

  useEffect(() => {
    if (!effectiveConversationId) return;
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
        try {
          tl.forEach((it) => seenRef.current.add(it.id));
        } catch {}
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 0);
        
        // Marcar como leído después de cargar los mensajes
        await markAsRead();
      } catch (e: any) {
        toast.error(e?.message || "No se pudo cargar el historial");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [effectiveConversationId, selfId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline]);

  useEffect(() => {
    try {
      timeline.forEach((it) => seenRef.current.add(it.id));
    } catch {}
  }, [timeline]);

  useEffect(() => {
    if (!effectiveConversationId) return;
    const client = getPusherClient();
    if (!client) return;
    const channel = `private-conversation-${effectiveConversationId}`;
    const ch = subscribePrivate(channel);
    if (!ch) return;

    const onChatMessageNew = async (msg: any) => {
      const key = `msg-${msg?.id}`;
      if (seenRef.current.has(key)) return;
      const isIncoming = String(msg?.sender_id || "") !== String(selfId);
      setTimeline((prev) => {
        // Si el mensaje es propio (outgoing) reemplazamos el optimista temp- por el definitivo del servidor
        if (!isIncoming) {
          let replaced = false;
          const mapped = prev.map((it) => {
            if (!replaced && it.type === "outgoing" && it.id.startsWith("msg-temp-") && it.body === (msg?.body || it.body)) {
              replaced = true;
              return {
                id: key,
                type: "outgoing" as const,
                message_id: effectiveConversationId,
                body: msg?.body,
                created_at: msg?.created_at || new Date().toISOString(),
                sender_name: selfName ?? it.sender_name,
                sender_email: selfEmail ?? it.sender_email,
                avatar_url: selfAvatarUrl ?? it.avatar_url,
              };
            }
            return it;
          });
          // Si no encontramos optimista, agregamos al final (fallback)
          const next = replaced
            ? mapped
            : mapped.concat({
                id: key,
                type: "outgoing" as const,
                message_id: effectiveConversationId,
                body: msg?.body,
                created_at: msg?.created_at || new Date().toISOString(),
                sender_name: selfName || undefined,
                sender_email: selfEmail || undefined,
                avatar_url: selfAvatarUrl || undefined,
              });
          seenRef.current.add(key);
          return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }

        // Mensaje entrante: simplemente agregamos
        const next = prev.concat({
          id: key,
          type: "incoming" as const,
          message_id: effectiveConversationId,
          body: msg?.body,
          created_at: msg?.created_at || new Date().toISOString(),
          sender_name: msg?.sender_name ?? counterpartyName ?? undefined,
          sender_email: msg?.sender_email ?? undefined,
          avatar_url: msg?.avatar_url ?? counterpartyAvatarUrl ?? undefined,
        });
        seenRef.current.add(key);
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      // Si la conversación está abierta y llega un mensaje entrante, marcar como leído con debounce
      if (isIncoming) {
        if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
        readDebounceRef.current = setTimeout(() => {
          // No await para no bloquear el handler de realtime
          markAsRead();
        }, 120);
      }
    };

    ch.bind("chat:message:new", onChatMessageNew);
    return () => {
      ch.unbind("chat:message:new", onChatMessageNew);
      getPusherClient()?.unsubscribe(channel);
    };
  }, [effectiveConversationId, selfId]);

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

  async function onMarkRead() {
    try {
      await markConversationRead(effectiveConversationId);
      toast.success("Conversación marcada como leída");
      try {
        onConversationRead?.(effectiveConversationId);
      } catch {}
    } catch (e: any) {
      toast.error(e?.message || "No se pudo marcar como leída");
    }
  }

  async function onHideConversation() {
    try {
      const ok = await confirmModal({
        title: "Ocultar conversación",
        description:
          "Se ocultará esta conversación solo para ti. Volverá a aparecer automáticamente si hay nueva actividad.",
        confirmText: "Ocultar",
        cancelText: "Cancelar",
      });
      if (!ok) return;
      const res = await fetch(`/api/chat/conversations/${encodeURIComponent(effectiveConversationId)}/hide`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || j?.error || "No se pudo ocultar");
      toast.success("Conversación oculta");
    } catch (e: any) {
      toast.error(e?.message || "Error al ocultar la conversación");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8">
              <AvatarImage src={headerAvatar} alt={avatarAltHeader(headerName)} />
              <AvatarFallback>{(((headerName || "U")[0]) || "U").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium text-base">{headerName || ""}</div>
              <div className="truncate text-xs text-muted-foreground">Conversación</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Más acciones" title="Más acciones">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onHideConversation}>Ocultar conversación</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
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
    </div>
  );
}
