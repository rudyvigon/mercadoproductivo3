"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import ChatInput, { ReplyPayload } from "./chat-input";
import { subscribePrivate, getPusherClient } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markDeliveredAndRead } from "@/lib/chat/delivery";

export default function ChatWindow({
  open,
  onOpenChange,
  sellerId,
  contactEmail,
  contactName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sellerId: string;
  contactEmail: string;
  contactName?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<ChatItem[]>([]);
  const [messageIds, setMessageIds] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Dedupe de eventos (msg/rep) para evitar duplicados entre onSent y realtime
  const seenRef = useRef<Set<string>>(new Set());
  // Dedupe de marcado delivered/read para evitar llamadas repetidas
  const markedRef = useRef<Set<string>>(new Set());
  const lastInboundId = useMemo(() => {
    const inbound = [...timeline].filter((t) => t.type === "incoming");
    return inbound.length ? inbound[inbound.length - 1].message_id || null : null;
  }, [timeline]);
  const effectiveMessageId = useMemo(() => {
    if (lastInboundId) return lastInboundId;
    const last = timeline.length ? timeline[timeline.length - 1] : null;
    if (last?.message_id) return last.message_id;
    if (messageIds.size === 1) return Array.from(messageIds)[0];
    return null;
  }, [lastInboundId, timeline, messageIds]);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sellerId, email: contactEmail });
        const res = await fetch(`/api/messages/history?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "Error al cargar historial");
        const tl: ChatItem[] = (data?.timeline || []) as ChatItem[];
        setTimeline(tl);
        // Sembrar dedupe con los elementos iniciales
        try {
          tl.forEach((it) => seenRef.current.add(it.id));
        } catch {}
        const ids = new Set<string>((data?.items || []).map((m: any) => m.id));
        setMessageIds(ids);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 0);
      } catch (e: any) {
        toast.error(e?.message || "No se pudo cargar el historial");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, sellerId, contactEmail]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline]);

  // Si cambia el timeline por otras razones, asegurar ids en seenRef
  useEffect(() => {
    try {
      timeline.forEach((it) => seenRef.current.add(it.id));
    } catch {}
  }, [timeline]);

  useEffect(() => {
    if (!open || !sellerId) return;
    const client = getPusherClient();
    if (!client) return;
    const ch = subscribePrivate(`private-seller-${sellerId}`);
    if (!ch) return;

    const onNew = (msg: any) => {
      if (msg?.sender_email !== contactEmail) return;
      // Siempre registrar el id del hilo aunque sea placeholder (body vacío)
      setMessageIds((prev) => new Set(Array.from(prev).concat(msg.id)));
      // Ignorar placeholder de start-by-seller: body == '—' y status == 'replied'
      const bodyTrim = String(msg?.body || "").trim();
      if (bodyTrim.length === 0) return;
      if (bodyTrim === "—" && String(msg?.status) === "replied") return;
      const key = `msg-${msg.id}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      // Marcar delivered+read para mensajes entrantes al vendedor
      if (!markedRef.current.has(key)) {
        markedRef.current.add(key);
        try {
          markDeliveredAndRead("msg", String(msg.id));
        } catch {}
      }
      setTimeline((prev) => {
        const next = prev.concat({
          id: key,
          type: "incoming",
          message_id: msg.id,
          body: msg.body,
          created_at: msg.created_at,
          sender_name: msg.sender_name,
          sender_email: msg.sender_email,
        });
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    };

    const onReply = (rep: ReplyPayload) => {
      if (!rep?.message_id) return;
      if (!messageIds.has(rep.message_id)) return;
      const key = `rep-${rep.id}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      // Orientación: si lo envió el vendedor (sender_id === sellerId) es outgoing; si fue el comprador, incoming
      const isOutgoing = String(rep.sender_id || "") === String(sellerId);
      // Si es entrante para el vendedor, marcar delivered+read
      if (!isOutgoing && !markedRef.current.has(key)) {
        markedRef.current.add(key);
        try {
          markDeliveredAndRead("rep", String(rep.id));
        } catch {}
      }
      setTimeline((prev) => {
        const next = prev.concat({
          id: key,
          type: isOutgoing ? "outgoing" : "incoming",
          message_id: rep.message_id,
          body: rep.body,
          created_at: rep.created_at,
        });
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    };

    // Helpers de actualización de estado
    const upgrade = (curr: "sent" | "delivered" | "read" | undefined, next: "delivered" | "read") => {
      if (next === "delivered") return curr === "read" ? "read" : "delivered";
      return "read";
    };

    const onReplyDelivered = (evt: any) => {
      const id = `rep-${evt?.id}`;
      setTimeline((prev) =>
        prev.map((it) =>
          it.id === id && it.type === "outgoing"
            ? { ...it, delivery_status: upgrade(it.delivery_status, "delivered") }
            : it
        )
      );
    };

    const onReplyRead = (evt: any) => {
      const id = `rep-${evt?.id}`;
      setTimeline((prev) => prev.map((it) => (it.id === id && it.type === "outgoing" ? { ...it, delivery_status: "read" } : it)));
    };

    const onMessageDeleted = (evt: any) => {
      // Asegurar conversación correcta
      if (evt?.sender_email && evt.sender_email !== contactEmail) return;
      const id = `msg-${evt?.id}`;
      setTimeline((prev) => prev.map((it) => (it.id === id ? { ...it, deleted: true } : it)));
    };
    const onReplyDeleted = (evt: any) => {
      // Verificar que el reply pertenezca al hilo abierto
      if (evt?.message_id && !messageIds.has(evt.message_id)) return;
      const id = `rep-${evt?.id}`;
      setTimeline((prev) => prev.map((it) => (it.id === id ? { ...it, deleted: true } : it)));
    };

    ch.bind("message:new", onNew);
    ch.bind("reply:new", onReply);
    ch.bind("message:deleted", onMessageDeleted);
    ch.bind("reply:deleted", onReplyDeleted);
    ch.bind("reply:delivered", onReplyDelivered);
    ch.bind("reply:read", onReplyRead);
    return () => {
      ch.unbind("message:new", onNew);
      ch.unbind("reply:new", onReply);
      ch.unbind("message:deleted", onMessageDeleted);
      ch.unbind("reply:deleted", onReplyDeleted);
      ch.unbind("reply:delivered", onReplyDelivered);
      ch.unbind("reply:read", onReplyRead);
      getPusherClient()?.unsubscribe(`private-seller-${sellerId}`);
    };
  }, [open, sellerId, contactEmail, messageIds]);

  // Cuando se carga/actualiza el timeline, marcar delivered+read de los items entrantes
  useEffect(() => {
    if (!open) return;
    for (const it of timeline) {
      if (it.type !== "incoming") continue;
      const key = it.id;
      if (markedRef.current.has(key)) continue;
      markedRef.current.add(key);
      try {
        if (key.startsWith("msg-") && it.message_id) {
          markDeliveredAndRead("msg", String(it.message_id));
        } else if (key.startsWith("rep-")) {
          const repId = key.slice(4);
          if (repId) markDeliveredAndRead("rep", repId);
        }
      } catch {}
    }
  }, [open, timeline]);

  function handleSent(payload: ReplyPayload) {
    const key = `rep-${payload.id}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    setTimeline((prev) => {
      const next = prev.concat({
        id: key,
        type: "outgoing",
        message_id: payload.message_id,
        body: payload.body,
        created_at: payload.created_at,
      });
      return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    if (payload.message_id) {
      setMessageIds((prev) => new Set(Array.from(prev).concat(payload.message_id)));
    }
  }

  function handleDeletedLocal(id: string, kind: "msg" | "rep") {
    const fullId = `${kind}-${id}`;
    setTimeline((prev) => prev.map((it) => (it.id === fullId ? { ...it, deleted: true } : it)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[96vw] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={undefined} alt={contactName || contactEmail} />
              <AvatarFallback>{(contactName?.[0] || contactEmail?.[0] || "U").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">{contactName || contactEmail}</DialogTitle>
              <DialogDescription className="truncate">{contactEmail}</DialogDescription>
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
              <ChatMessages items={timeline} onDeleted={handleDeletedLocal} />
            )}
          </div>
          <div className="border-t p-3">
            <ChatInput messageId={effectiveMessageId} sellerId={sellerId} contactEmail={contactEmail} onSent={handleSent} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
