"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import BuyerChatInput, { BuyerInputSent } from "./buyer-chat-input";
import { subscribePrivate, getPusherClient } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/chat/delivery";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromTimeline, headerAvatarFromTimeline, avatarAltHeader } from "@/lib/user-display";

export default function BuyerConversationWindow({
  open,
  onOpenChange,
  sellerId,
  sellerName,
  sellerAvatarUrl,
  currentUserEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sellerId: string;
  sellerName?: string | null;
  sellerAvatarUrl?: string;
  currentUserEmail: string;
}) {
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [selfEmail, setSelfEmail] = useState<string | null>(null);
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Dedupe de eventos (msg/rep) para evitar duplicados entre onSent y realtime
  const seenRef = useRef<Set<string>>(new Set());
  // Marcado de leído por conversación
  const readMarkedRef = useRef<boolean>(false);

  // Último message_id de mensajes OUTGOING (comprador) para enganchar replies
  // En Chat v2, threadId representa conversationId directamente
  const effectiveThreadId = threadId;
  const supabase = useMemo(() => createClient(), []);

  // Nombre efectivo mostrado en el header: prioriza el nombre del último mensaje entrante
  const headerName = useMemo(() => displayNameFromTimeline(timeline, sellerName), [timeline, sellerName]);
  const headerAvatar = useMemo(() => headerAvatarFromTimeline(timeline, sellerAvatarUrl), [timeline, sellerAvatarUrl]);

  // Cargar perfil propio para mostrar avatar/nombre en mensajes salientes inmediatos
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from("profiles")
          .select("full_name,avatar_url")
          .eq("id", uid)
          .single();
        setSelfName((data?.full_name || "").toString().trim() || null);
        // El email proviene de auth.users, no de profiles
        setSelfEmail((auth?.user?.email || "").toString().trim() || null);
        setSelfAvatarUrl((data?.avatar_url || "").toString().trim() || null);
      } catch {}
    })();
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        // Asegurar/obtener conversación (DM) con el vendedor
        const startRes = await fetch("/api/chat/conversations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: sellerId }),
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData?.message || startData?.error || "No se pudo iniciar la conversación");
        const conversationId = String(startData?.conversation_id || "");
        if (!conversationId) throw new Error("No se pudo obtener la conversación");
        setThreadId(conversationId);

        // Cargar mensajes de Chat v2
        const url = new URL(`/api/chat/conversations/${conversationId}/messages`, window.location.origin);
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
            type: String(m.sender_id) === String(sellerId) ? "incoming" : "outgoing",
            message_id: conversationId,
            body: m.body,
            created_at: m.created_at,
            sender_name: m.sender_name,
            sender_email: m.sender_email,
            avatar_url: m.avatar_url,
          }));
        setTimeline(tl);
        // Sembrar dedupe
        try { tl.forEach((it) => seenRef.current.add(it.id)); } catch {}

        // Scroll al final y marcar leído
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 0);
        try {
          if (!readMarkedRef.current) {
            await markConversationRead(conversationId);
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
  }, [open, sellerId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline]);

  // Si timeline cambia por otras razones, asegurar ids dedupe
  useEffect(() => {
    try {
      timeline.forEach((it) => seenRef.current.add(it.id));
    } catch {}
  }, [timeline]);

  useEffect(() => {
    if (!open || !sellerId || !effectiveThreadId) return;
    const client = getPusherClient();
    if (!client) return;
    const channel = `private-conversation-${effectiveThreadId}`;
    const ch = subscribePrivate(channel);
    if (!ch) return;

    const onChatMessageNew = async (msg: any) => {
      const key = `msg-${msg?.id}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      const isIncoming = String(msg?.sender_id || "") === String(sellerId);
      setTimeline((prev) => {
        const next = prev.concat({
          id: key,
          type: isIncoming ? "incoming" : "outgoing",
          message_id: effectiveThreadId,
          body: msg?.body,
          created_at: msg?.created_at || new Date().toISOString(),
          sender_name: msg?.sender_name ?? (isIncoming ? sellerName : selfName) ?? undefined,
          sender_email: msg?.sender_email ?? (isIncoming ? undefined : selfEmail) ?? undefined,
          avatar_url: msg?.avatar_url ?? (isIncoming ? sellerAvatarUrl : selfAvatarUrl) ?? undefined,
        });
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      // Marcar leído si es entrante
      try {
        if (isIncoming && !readMarkedRef.current) {
          await markConversationRead(effectiveThreadId);
          readMarkedRef.current = true;
        }
      } catch {}
    };

    ch.bind("chat:message:new", onChatMessageNew);
    return () => {
      ch.unbind("chat:message:new", onChatMessageNew);
      getPusherClient()?.unsubscribe(channel);
    };
  }, [open, sellerId, effectiveThreadId]);

  // Marcar leído al abrir si hay conversación y mensajes cargados
  useEffect(() => {
    if (!open || !effectiveThreadId || readMarkedRef.current === true) return;
    if (timeline.some((t) => t.type === "incoming")) {
      (async () => {
        try {
          await markConversationRead(effectiveThreadId);
          readMarkedRef.current = true;
        } catch {}
      })();
    }
  }, [open, effectiveThreadId, timeline]);

  function handleSent(evt: BuyerInputSent) {
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
    setThreadId(evt.message_id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[96vw] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={headerAvatar} alt={avatarAltHeader(headerName)} />
              <AvatarFallback>{(((headerName || "U")[0]) || "U").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">{headerName || ""}</DialogTitle>
              <DialogDescription className="truncate">Conversación con el vendedor</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn("flex min-h-0 flex-1 flex-col")}> 
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Cargando...</div>
            ) : timeline.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Inicia la conversación</div>
            ) : (
              <ChatMessages items={timeline} />
            )}
          </div>
          <div className="border-t p-3">
            <BuyerChatInput sellerId={sellerId} threadId={effectiveThreadId} onSent={handleSent} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
