"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import BuyerChatInput, { BuyerInputSent } from "./buyer-chat-input";
import { subscribePrivate, getPusherClient } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emailSlug } from "@/lib/email";
import { markDeliveredAndRead } from "@/lib/chat/delivery";

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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Dedupe de eventos (msg/rep) para evitar duplicados entre onSent y realtime
  const seenRef = useRef<Set<string>>(new Set());
  // Dedupe de marcado delivered/read
  const markedRef = useRef<Set<string>>(new Set());

  // Último message_id de mensajes OUTGOING (comprador) para enganchar replies
  const lastBuyerMessageId = useMemo(() => {
    const outs = [...timeline].filter((t) => t.type === "outgoing");
    return outs.length ? outs[outs.length - 1].message_id || null : null;
  }, [timeline]);
  // En caso de que el vendedor haya iniciado la conversación, podemos tener solo INCOMING
  const lastIncomingId = useMemo(() => {
    const ins = [...timeline].filter((t) => t.type === "incoming");
    return ins.length ? ins[ins.length - 1].message_id || null : null;
  }, [timeline]);
  const effectiveThreadId = threadId ?? lastBuyerMessageId ?? lastIncomingId ?? null;

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sellerId });
        const res = await fetch(`/api/messages/history/buyer?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "Error al cargar historial");
        const tl: ChatItem[] = (data?.timeline || []) as ChatItem[];
        setTimeline(tl);
        // Sembrar dedupe con los elementos iniciales
        try {
          tl.forEach((it) => seenRef.current.add(it.id));
        } catch {}
        // Preferir último OUTGOING; si no hay, tomar último INCOMING
        const lastOut = tl.filter((t) => t.type === "outgoing").slice(-1)[0]?.message_id || null;
        const lastIn = tl.filter((t) => t.type === "incoming").slice(-1)[0]?.message_id || null;
        setThreadId(lastOut || lastIn || null);
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
    if (!open || !sellerId || !currentUserEmail) return;
    const client = getPusherClient();
    if (!client) return;
    const channel = `private-thread-${sellerId}-${emailSlug(currentUserEmail)}`;
    const ch = subscribePrivate(channel);
    if (!ch) return;

    const onMessageNew = (msg: any) => {
      // event del propio comprador: agregar outgoing
      if (msg?.sender_email && String(msg.sender_email).toLowerCase() !== String(currentUserEmail).toLowerCase()) {
        // En teoría no debería ocurrir en este canal, pero por seguridad lo ignoramos
        return;
      }
      const key = `msg-${msg.id}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      setTimeline((prev) => {
        const next = prev.concat({
          id: key,
          type: "outgoing",
          message_id: msg.id,
          body: msg.body,
          created_at: msg.created_at,
          sender_name: msg.sender_name,
          sender_email: msg.sender_email,
        });
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      setThreadId(msg.id);
    };

    const onReplyNew = (rep: any) => {
      if (!rep?.message_id) return;
      const key = `rep-${rep.id}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      // Orientación: si lo envió el vendedor (sender_id === sellerId) es incoming; si lo envió el comprador, outgoing
      const isIncoming = String(rep.sender_id || "") === String(sellerId);
      // Si es incoming para el comprador, marcar delivered+read
      if (isIncoming && !markedRef.current.has(key)) {
        markedRef.current.add(key);
        try {
          markDeliveredAndRead("rep", String(rep.id));
        } catch {}
      }
      setTimeline((prev) => {
        const next = prev.concat({
          id: key,
          type: isIncoming ? "incoming" : "outgoing",
          message_id: rep.message_id,
          body: rep.body,
          created_at: rep.created_at,
        });
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      setThreadId((prev) => prev ?? rep.message_id);
    };

    // Helpers de actualización de estado
    const upgrade = (curr: "sent" | "delivered" | "read" | undefined, next: "delivered" | "read") => {
      if (next === "delivered") return curr === "read" ? "read" : "delivered";
      return "read";
    };

    const onMessageDelivered = (evt: any) => {
      const id = `msg-${evt?.id}`;
      setTimeline((prev) =>
        prev.map((it) =>
          it.id === id && it.type === "outgoing"
            ? { ...it, delivery_status: upgrade(it.delivery_status, "delivered") }
            : it
        )
      );
    };

    const onMessageRead = (evt: any) => {
      const id = `msg-${evt?.id}`;
      setTimeline((prev) => prev.map((it) => (it.id === id && it.type === "outgoing" ? { ...it, delivery_status: "read" } : it)));
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

    ch.bind("message:new", onMessageNew);
    ch.bind("reply:new", onReplyNew);
    ch.bind("message:delivered", onMessageDelivered);
    ch.bind("message:read", onMessageRead);
    ch.bind("reply:delivered", onReplyDelivered);
    ch.bind("reply:read", onReplyRead);
    return () => {
      ch.unbind("message:new", onMessageNew);
      ch.unbind("reply:new", onReplyNew);
      ch.unbind("message:delivered", onMessageDelivered);
      ch.unbind("message:read", onMessageRead);
      ch.unbind("reply:delivered", onReplyDelivered);
      ch.unbind("reply:read", onReplyRead);
      getPusherClient()?.unsubscribe(channel);
    };
  }, [open, sellerId, currentUserEmail]);

  // Al cargar/actualizar timeline, marcar delivered+read de items entrantes para el comprador
  useEffect(() => {
    if (!open) return;
    for (const it of timeline) {
      if (it.type !== "incoming") continue;
      const key = it.id;
      if (markedRef.current.has(key)) continue;
      markedRef.current.add(key);
      try {
        if (key.startsWith("rep-")) {
          const repId = key.slice(4);
          if (repId) markDeliveredAndRead("rep", repId);
        } else if (key.startsWith("msg-") && it.message_id) {
          // Caso poco frecuente: si hubiera un mensaje entrante (no placeholder)
          markDeliveredAndRead("msg", String(it.message_id));
        }
      } catch {}
    }
  }, [open, timeline]);

  function handleSent(evt: BuyerInputSent) {
    const key = `${evt.kind === "message" ? "msg" : "rep"}-${evt.id}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    setTimeline((prev) => {
      const next = prev.concat({
        id: key,
        type: "outgoing",
        message_id: evt.message_id,
        body: evt.body,
        created_at: evt.created_at,
      });
      return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    if (evt.kind === "message") setThreadId(evt.message_id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[96vw] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={sellerAvatarUrl} alt={sellerName || "Vendedor"} />
              <AvatarFallback>{(sellerName?.[0] || "V").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">{sellerName || "Vendedor"}</DialogTitle>
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
