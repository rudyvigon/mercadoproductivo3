"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContentNoClose, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import ConversationChatInput, { ChatV2Sent } from "./conversation-chat-input";
import { subscribePrivate, getPusherClient, onConnectionStateChange, safeUnsubscribe } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/chat/delivery";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromTimeline, headerAvatarFromTimeline, avatarAltHeader } from "@/lib/user-display";
import { MessageNewEventSchema } from "@/lib/chat/events";

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
  // Último created_at visto para fetch incremental
  const lastSeenAtRef = useRef<string | null>(null);
  // Evitar fetches incrementales concurrentes
  const fetchingIncRef = useRef<boolean>(false);
  // Guard para saber si ya terminamos carga inicial
  const initialLoadedRef = useRef<boolean>(false);

  const effectiveConversationId = conversationId;
  const supabase = useMemo(() => createClient(), []);

  // Refs para valores usados dentro de handlers de realtime
  const selfNameRef = useRef<string | null>(null);
  const selfEmailRef = useRef<string | null>(null);
  const selfAvatarUrlRef = useRef<string | null>(null);
  const counterpartyNameRef = useRef<string | null | undefined>(counterpartyName);
  const counterpartyAvatarUrlRef = useRef<string | null | undefined>(counterpartyAvatarUrl);

  // Nombre y avatar efectivos en el header: prioriza el último entrante
  const headerName = useMemo(() => displayNameFromTimeline(timeline, counterpartyName), [timeline, counterpartyName]);
  const headerAvatar = useMemo(() => headerAvatarFromTimeline(timeline, counterpartyAvatarUrl), [timeline, counterpartyAvatarUrl]);

  // Sincronizar refs con estado/props
  useEffect(() => { selfNameRef.current = selfName; }, [selfName]);
  useEffect(() => { selfEmailRef.current = selfEmail; }, [selfEmail]);
  useEffect(() => { selfAvatarUrlRef.current = selfAvatarUrl; }, [selfAvatarUrl]);
  useEffect(() => { counterpartyNameRef.current = counterpartyName; }, [counterpartyName]);
  useEffect(() => { counterpartyAvatarUrlRef.current = counterpartyAvatarUrl; }, [counterpartyAvatarUrl]);

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const msgRes = await fetch(url.toString(), { cache: "no-store", signal: controller.signal });
        clearTimeout(timeoutId);
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
        // Marcar que la carga inicial terminó
        initialLoadedRef.current = true;
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

  // Si timeline cambia por otras razones, asegurar ids dedupe y actualizar último created_at
  useEffect(() => {
    try {
      timeline.forEach((it) => seenRef.current.add(it.id));
      let maxAt: string | null = lastSeenAtRef.current ?? null;
      for (const it of timeline) {
        if (!maxAt || new Date(it.created_at).getTime() > new Date(maxAt).getTime()) {
          maxAt = it.created_at;
        }
      }
      lastSeenAtRef.current = maxAt;
    } catch {}
  }, [timeline]);

  // Handler validado para nuevo mensaje
  const onChatMessageNew = useCallback(async (raw: any) => {
    const parsed = MessageNewEventSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("Payload inválido para chat:message:new", parsed.error);
      return;
    }
    const msg = parsed.data;
    const key = msg?.id != null
      ? `msg-${msg.id}`
      : `msg-${String(msg.sender_id ?? "u")}-${String(msg.created_at ?? Date.now())}`;
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
        sender_name: msg?.sender_name ?? (isIncoming ? counterpartyNameRef.current : selfNameRef.current) ?? undefined,
        sender_email: msg?.sender_email ?? (isIncoming ? undefined : selfEmailRef.current) ?? undefined,
        avatar_url: msg?.avatar_url ?? (isIncoming ? counterpartyAvatarUrlRef.current : selfAvatarUrlRef.current) ?? undefined,
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
  }, [effectiveConversationId, selfId]);

  // Suscripción realtime a la conversación específica (Chat v2) con backoff exponencial y jitter
  useEffect(() => {
    if (!open || !effectiveConversationId) return;
    const channel = `private-conversation-${effectiveConversationId}`;
    let disposed = false;
    let ch: any = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let handlersBound = false;

    const bindHandlers = () => {
      if (!ch || handlersBound) return;
      ch.bind("chat:message:new", onChatMessageNew);
      handlersBound = true;
    };

    const unbindHandlers = () => {
      try { ch?.unbind?.("chat:message:new", onChatMessageNew); } catch {}
      handlersBound = false;
    };

    const scheduleRetry = (status?: number) => {
      if (disposed) return;
      if (status === 403) {
        console.warn("Pusher subscription forbidden (403)", channel);
        return;
      }
      attempt += 1;
      const base = 500;
      const cap = 30000;
      const backoff = Math.min(cap, Math.round(base * Math.pow(2, attempt)));
      const jitter = Math.floor(Math.random() * Math.min(1000, Math.max(250, Math.floor(backoff * 0.3))));
      const delay = backoff + jitter;
      try { if (retryTimer) clearTimeout(retryTimer); } catch {}
      retryTimer = setTimeout(trySubscribe, delay);
    };

    const trySubscribe = () => {
      if (disposed) return;
      const p = getPusherClient();
      if (!p) { scheduleRetry(undefined); return; }
      ch = subscribePrivate(channel, {
        onSubscriptionSucceeded: () => { attempt = 0; bindHandlers(); },
        onSubscriptionError: (status) => { console.warn("Subscription error", status, channel); scheduleRetry(status); },
      });
      if (!ch) { scheduleRetry(undefined); return; }
    };

    trySubscribe();

    return () => {
      disposed = true;
      try { if (retryTimer) clearTimeout(retryTimer); } catch {}
      try { unbindHandlers(); } catch {}
      try { safeUnsubscribe(channel); } catch {}
    };
  }, [open, effectiveConversationId, onChatMessageNew]);

  // Helper para restar milisegundos a un ISO string
  const isoMinusMs = useCallback((iso: string, ms: number) => {
    try {
      const d = new Date(iso);
      return new Date(d.getTime() - Math.max(0, ms)).toISOString();
    } catch {
      return iso;
    }
  }, []);

  // Fetch incremental tras reconexión o gaps
  const fetchIncremental = useCallback(async () => {
    if (!open || !effectiveConversationId) return;
    if (fetchingIncRef.current) return;
    fetchingIncRef.current = true;
    try {
      const url = new URL(`/api/chat/conversations/${effectiveConversationId}/messages`, window.location.origin);
      url.searchParams.set("limit", "200");
      const last = lastSeenAtRef.current;
      if (last) url.searchParams.set("after", isoMinusMs(last, 1000));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url.toString(), { cache: "no-store", signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Error al sincronizar mensajes");
      const rows = Array.isArray(data?.messages) ? data.messages : [];
      if (rows.length === 0) return;
      // Detección de brechas: si llegan demasiados mensajes, hacer re-sync completo
      const GAP_THRESHOLD = 180;
      if (rows.length >= GAP_THRESHOLD) {
        try {
          const full = new URL(`/api/chat/conversations/${effectiveConversationId}/messages`, window.location.origin);
          full.searchParams.set("limit", "200");
          const ctrl2 = new AbortController();
          const t2 = setTimeout(() => ctrl2.abort(), 15000);
          const r2 = await fetch(full.toString(), { cache: "no-store", signal: ctrl2.signal });
          clearTimeout(t2);
          const j2 = await r2.json();
          if (r2.ok) {
            const all = Array.isArray(j2?.messages) ? j2.messages : [];
            const items: ChatItem[] = all.map((m: any) => ({
              id: `msg-${m.id}`,
              type: String(m.sender_id) !== String(selfId) ? "incoming" : "outgoing",
              message_id: effectiveConversationId,
              body: m.body,
              created_at: m.created_at,
              sender_name: m.sender_name,
              sender_email: m.sender_email,
              avatar_url: m.avatar_url,
            }));
            setTimeline(items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            try { items.forEach((it) => seenRef.current.add(it.id)); } catch {}
            return;
          }
        } catch {}
      }
      const items: ChatItem[] = rows.map((m: any) => {
        const isIncoming = String(m.sender_id) !== String(selfId);
        return {
          id: `msg-${m.id}`,
          type: isIncoming ? "incoming" : "outgoing",
          message_id: effectiveConversationId,
          body: m.body,
          created_at: m.created_at,
          sender_name: m.sender_name,
          sender_email: m.sender_email,
          avatar_url: m.avatar_url,
        } as ChatItem;
      });
      const hasIncoming = rows.some((m: any) => String(m.sender_id) !== String(selfId));
      setTimeline((prev) => {
        const map = new Map(prev.map((it) => [it.id, it] as const));
        for (const it of items) {
          if (!map.has(it.id)) map.set(it.id, it);
        }
        const next = Array.from(map.values());
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return next;
      });
      try { items.forEach((it) => seenRef.current.add(it.id)); } catch {}
      // Marcar leído si el fetch incremental trajo mensajes entrantes
      try {
        if (hasIncoming && effectiveConversationId) {
          await markConversationRead(effectiveConversationId);
          readMarkedRef.current = true;
        }
      } catch {}
    } catch (e) {
      console.warn("Incremental fetch failed:", e);
    } finally {
      fetchingIncRef.current = false;
    }
  }, [open, effectiveConversationId, selfId, isoMinusMs]);

  // Reintento tras reconexión de Pusher: relleno incremental de gaps
  useEffect(() => {
    if (!open || !effectiveConversationId) return;
    const off = onConnectionStateChange((state) => {
      if (!initialLoadedRef.current) return;
      if (state === "connected") {
        setTimeout(() => { void fetchIncremental(); }, 120);
      }
    });
    return () => { try { off?.(); } catch {} };
  }, [open, effectiveConversationId, fetchIncremental]);

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
