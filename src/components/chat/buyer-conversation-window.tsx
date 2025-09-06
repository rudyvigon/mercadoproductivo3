"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import BuyerChatInput, { BuyerInputSent } from "./buyer-chat-input";
import { subscribePrivate, getPusherClient, onConnectionStateChange, safeUnsubscribe } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/chat/delivery";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromTimeline, headerAvatarFromTimeline, avatarAltHeader } from "@/lib/user-display";
import { MessageNewEventSchema } from "@/lib/chat/events";

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
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Dedupe de eventos (msg/rep) para evitar duplicados entre onSent y realtime
  const seenRef = useRef<Set<string>>(new Set());
  // Marcado de leído por conversación
  const readMarkedRef = useRef<boolean>(false);
  // Último created_at visto para fetch incremental
  const lastSeenAtRef = useRef<string | null>(null);
  // Flag para evitar fetches incrementales concurrentes
  const fetchingIncRef = useRef<boolean>(false);
  // Guard para saber si ya terminamos carga inicial
  const initialLoadedRef = useRef<boolean>(false);

  // Último message_id de mensajes OUTGOING (comprador) para enganchar replies
  // En Chat v2, threadId representa conversationId directamente
  const effectiveThreadId = threadId;
  const supabase = useMemo(() => createClient(), []);

  // Nombre efectivo mostrado en el header: prioriza el nombre del último mensaje entrante
  const headerName = useMemo(() => displayNameFromTimeline(timeline, sellerName), [timeline, sellerName]);
  const headerAvatar = useMemo(() => headerAvatarFromTimeline(timeline, sellerAvatarUrl), [timeline, sellerAvatarUrl]);

  // Comparador estable por fecha + desempate por id
  const compareItems = useCallback((a: ChatItem, b: ChatItem) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  }, []);

  const isoMinusMs = useCallback((iso: string, ms: number) => {
    try {
      const d = new Date(iso);
      return new Date(d.getTime() - Math.max(0, ms)).toISOString();
    } catch {
      return iso;
    }
  }, []);

  function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
    const { timeoutMs = 10000, ...rest } = opts;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(t));
  }

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
        const msgRes = await fetchWithTimeout(url.toString(), { cache: "no-store", timeoutMs: 10000 } as any);
        const msgData = await msgRes.json();
        if (!msgRes.ok) throw new Error(msgData?.message || msgData?.error || "Error al cargar historial");
        const rows = Array.isArray(msgData?.messages) ? msgData.messages : [];
        const tl: ChatItem[] = rows
          .slice()
          .sort((a: any, b: any) => {
            const ta = new Date(a.created_at).getTime();
            const tb = new Date(b.created_at).getTime();
            if (ta !== tb) return ta - tb;
            return String(a.id).localeCompare(String(b.id));
          })
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
        // Marcar que la carga inicial terminó
        initialLoadedRef.current = true;

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
      // Actualizar último created_at visto
      let maxAt: string | null = lastSeenAtRef.current ?? null;
      for (const it of timeline) {
        if (!maxAt || new Date(it.created_at).getTime() > new Date(maxAt).getTime()) {
          maxAt = it.created_at;
        }
      }
      lastSeenAtRef.current = maxAt;
    } catch {}
  }, [timeline]);

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
    const isIncoming = String(msg?.sender_id || "") === String(sellerId);
    setTimeline((prev) => {
      const next = prev.concat({
        id: key,
        type: isIncoming ? "incoming" : "outgoing",
        message_id: effectiveThreadId!,
        body: msg?.body,
        created_at: msg?.created_at || new Date().toISOString(),
        sender_name: msg?.sender_name ?? (isIncoming ? sellerName : selfName) ?? undefined,
        sender_email: msg?.sender_email ?? (isIncoming ? undefined : selfEmail) ?? undefined,
        avatar_url: msg?.avatar_url ?? (isIncoming ? sellerAvatarUrl : selfAvatarUrl) ?? undefined,
      });
      return next.sort(compareItems);
    });
    // Marcar leído si es entrante
    try {
      if (isIncoming && effectiveThreadId && !readMarkedRef.current) {
        await markConversationRead(effectiveThreadId);
        readMarkedRef.current = true;
      }
    } catch {}
  }, [sellerId, effectiveThreadId, sellerName, selfName, selfEmail, sellerAvatarUrl, selfAvatarUrl, compareItems]);

  useEffect(() => {
    if (!open || !sellerId || !effectiveThreadId) return;
    const channel = `private-conversation-${effectiveThreadId}`;
    let disposed = false;
    let ch: any = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let handlersBound = false;

    const bindHandlers = () => {
      if (!ch || handlersBound) return;
      ch.bind("chat:message:new", onChatMessageNew);
      ch.bind("chat:conversation:read", (payload: any) => {
        try {
          const uid = String(payload?.user_id || "");
          if (uid && uid === String(sellerId)) {
            const at = String(payload?.last_read_at || new Date().toISOString());
            setLastReadAt(at);
          }
        } catch {}
      });
      ch.bind("chat:typing", (payload: any) => {
        try {
          const uid = String(payload?.user_id || "");
          if (uid && uid === String(sellerId)) {
            setIsTyping(Boolean(payload?.typing));
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (payload?.typing) {
              typingTimerRef.current = setTimeout(() => setIsTyping(false), 3500);
            }
          }
        } catch {}
      });
      handlersBound = true;
    };

    const unbindHandlers = () => {
      try {
        ch?.unbind?.("chat:message:new", onChatMessageNew);
        ch?.unbind?.("chat:conversation:read");
        ch?.unbind?.("chat:typing");
      } catch {}
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
      const jitter = Math.floor(Math.random() * Math.min(1000, Math.max(250, Math.floor(backoff * 0.3))))
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
  }, [open, sellerId, effectiveThreadId, onChatMessageNew]);

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
      return next.sort(compareItems);
    });
    setThreadId(evt.message_id);
  }

  const fetchIncremental = useCallback(async () => {
    if (!open || !effectiveThreadId) return;
    if (fetchingIncRef.current) return;
    fetchingIncRef.current = true;
    try {
      const url = new URL(`/api/chat/conversations/${effectiveThreadId}/messages`, window.location.origin);
      url.searchParams.set("limit", "200");
      const last = lastSeenAtRef.current;
      if (last) url.searchParams.set("after", isoMinusMs(last, 1000));
      const res = await fetchWithTimeout(url.toString(), { cache: "no-store", timeoutMs: 12000 } as any);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Error al sincronizar mensajes");
      const rows = Array.isArray(data?.messages) ? data.messages : [];
      if (rows.length === 0) return;
      // Detección de brechas: si llegan demasiados mensajes, hacer re-sync completo
      const GAP_THRESHOLD = 180; // cercano al límite 200
      if (rows.length >= GAP_THRESHOLD) {
        try {
          const full = new URL(`/api/chat/conversations/${effectiveThreadId}/messages`, window.location.origin);
          full.searchParams.set("limit", "200");
          const r2 = await fetchWithTimeout(full.toString(), { cache: "no-store", timeoutMs: 15000 } as any);
          const j2 = await r2.json();
          if (r2.ok) {
            const all = Array.isArray(j2?.messages) ? j2.messages : [];
            const items: ChatItem[] = all.map((m: any) => ({
              id: `msg-${m.id}`,
              type: String(m.sender_id) === String(sellerId) ? "incoming" : "outgoing",
              message_id: effectiveThreadId,
              body: m.body,
              created_at: m.created_at,
              sender_name: m.sender_name,
              sender_email: m.sender_email,
              avatar_url: m.avatar_url,
            }));
            setTimeline(items.sort(compareItems));
            try { items.forEach((it) => seenRef.current.add(it.id)); } catch {}
            return;
          }
        } catch {}
      }
      const items: ChatItem[] = rows.map((m: any) => {
        const isIncoming = String(m.sender_id) === String(sellerId);
        return {
          id: `msg-${m.id}`,
          type: isIncoming ? "incoming" : "outgoing",
          message_id: effectiveThreadId,
          body: m.body,
          created_at: m.created_at,
          sender_name: m.sender_name,
          sender_email: m.sender_email,
          avatar_url: m.avatar_url,
        } as ChatItem;
      });
      const hasIncoming = rows.some((m: any) => String(m.sender_id) === String(sellerId));
      setTimeline((prev) => {
        const map = new Map(prev.map((it) => [it.id, it] as const));
        for (const it of items) {
          if (!map.has(it.id)) map.set(it.id, it);
        }
        const next = Array.from(map.values());
        next.sort(compareItems);
        return next;
      });
      try { items.forEach((it) => seenRef.current.add(it.id)); } catch {}
      // Marcar leído si el fetch incremental trajo mensajes entrantes
      try {
        if (hasIncoming && effectiveThreadId) {
          await markConversationRead(effectiveThreadId);
          readMarkedRef.current = true;
        }
      } catch {}
    } catch (e) {
      console.warn("Incremental fetch failed:", e);
    } finally {
      fetchingIncRef.current = false;
    }
  }, [open, effectiveThreadId, sellerId, compareItems, isoMinusMs]);

  // Reintento tras reconexión de Pusher: relleno incremental de gaps
  useEffect(() => {
    if (!open || !effectiveThreadId) return;
    const off = onConnectionStateChange((state) => {
      // Ejecutar solo si ya hicimos la carga inicial
      if (!initialLoadedRef.current) return;
      if (state === "connected") {
        // Pequeño delay para dejar estabilizar suscripciones
        setTimeout(() => { void fetchIncremental(); }, 120);
      }
    });
    return () => { try { off?.(); } catch {} };
  }, [open, effectiveThreadId, fetchIncremental]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[96vw] max-w-2xl flex-col p-0">
        <DialogHeader
          className="border-b p-4"
        >
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
              <DialogDescription className="truncate">Conversación con el vendedor</DialogDescription>
              {isTyping && (
                <div className="mt-0.5 text-xs text-muted-foreground italic">Escribiendo…</div>
              )}
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
              <ChatMessages items={timeline} lastReadAt={lastReadAt ?? undefined} />
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
