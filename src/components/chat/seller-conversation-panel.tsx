"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChatMessages, { ChatItem } from "./chat-messages";
import ConversationChatInput, { ChatV2Sent } from "./conversation-chat-input";
import { subscribePrivate, getPusherClient, onConnectionStateChange } from "@/lib/pusher/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/chat/delivery";
import { createClient } from "@/lib/supabase/client";
import { displayNameFromTimeline, headerAvatarFromTimeline, avatarAltHeader } from "@/lib/user-display";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import confirmModal from "@/components/ui/confirm-modal";
import { MoreVertical, X } from "lucide-react";

export default function SellerConversationPanel({
  conversationId,
  selfId,
  counterpartyName,
  counterpartyAvatarUrl,
  onConversationRead,
  onClose,
}: {
  conversationId: string;
  selfId: string;
  counterpartyName?: string | null;
  counterpartyAvatarUrl?: string | null;
  onConversationRead?: (conversationId: string) => void;
  onClose?: () => void;
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
  // Control de autoscroll
  const pinnedBottomRef = useRef<boolean>(true); // anclado al fondo al iniciar
  const lastOwnAppendRef = useRef<boolean>(false); // si el último agregado fue propio
  // Control de lecturas para evitar POST repetidos
  const lastReadIncomingKeyRef = useRef<string | null>(null);
  const lastReadPostAtRef = useRef<number>(0);

  const effectiveConversationId = conversationId;
  const supabase = useMemo(() => createClient(), []);
  const [connState, setConnState] = useState<string>("disconnected");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado de conexión (indicador visual)
  useEffect(() => {
    const off = onConnectionStateChange((state) => {
      try { setConnState(state as any); } catch {}
    });
    return () => { try { off?.(); } catch {} };
  }, []);

  // Helper: restar ms a un ISO para evitar inclusiones
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

  // Cargar mensajes anteriores con ?before
  async function loadOlder() {
    if (loadingOlder || !effectiveConversationId || timeline.length === 0 || !hasMoreOlder) return;
    setLoadingOlder(true);
    try {
      const earliest = timeline[0].created_at;
      const before = isoMinusMs(earliest, 1000);
      const url = new URL(`/api/chat/conversations/${effectiveConversationId}/messages`, window.location.origin);
      url.searchParams.set("limit", "50");
      url.searchParams.set("before", before);
      url.searchParams.set("order", "desc");

      const el = scrollRef.current;
      const prevHeight = el?.scrollHeight || 0;
      const prevTop = el?.scrollTop || 0;

      const res = await fetchWithTimeout(url.toString(), { cache: "no-store", timeoutMs: 12000 } as any);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || j?.error || "Error al cargar anteriores");
      const rows = Array.isArray(j?.messages) ? j.messages : [];
      if (rows.length === 0) { setHasMoreOlder(false); return; }

      const items: ChatItem[] = rows.map((m: any) => ({
        id: `msg-${m.id}`,
        type: String(m.sender_id) === String(selfId) ? "outgoing" : "incoming",
        message_id: effectiveConversationId,
        body: m.body,
        created_at: m.created_at,
        sender_name: m.sender_name,
        sender_email: m.sender_email,
        avatar_url: m.avatar_url,
      }));

      setTimeline((prev) => {
        const map = new Map<string, ChatItem>(prev.map((it) => [it.id, it] as [string, ChatItem]));
        for (const it of items) { if (!map.has(it.id)) map.set(it.id, it); }
        const next = Array.from(map.values()) as ChatItem[];
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || String(a.id).localeCompare(String(b.id)));
        return next;
      });

      requestAnimationFrame(() => {
        try {
          const el2 = scrollRef.current;
          if (el2) {
            const newHeight = el2.scrollHeight;
            el2.scrollTop = (newHeight - prevHeight) + prevTop;
          }
        } catch {}
      });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar más mensajes");
    } finally {
      setLoadingOlder(false);
    }
  }

  // Refs para estabilizar valores usados dentro de handlers de realtime
  const selfNameRef = useRef<string | null>(null);
  const selfEmailRef = useRef<string | null>(null);
  const selfAvatarUrlRef = useRef<string | null>(null);
  const counterpartyNameRef = useRef<string | null | undefined>(counterpartyName);
  const counterpartyAvatarUrlRef = useRef<string | null | undefined>(counterpartyAvatarUrl);
  const markAsReadRef = useRef<null | (() => void | Promise<void>)>(null);

  useEffect(() => { selfNameRef.current = selfName; }, [selfName]);
  useEffect(() => { selfEmailRef.current = selfEmail; }, [selfEmail]);
  useEffect(() => { selfAvatarUrlRef.current = selfAvatarUrl; }, [selfAvatarUrl]);
  useEffect(() => { counterpartyNameRef.current = counterpartyName; }, [counterpartyName]);
  useEffect(() => { counterpartyAvatarUrlRef.current = counterpartyAvatarUrl; }, [counterpartyAvatarUrl]);

  const headerName = useMemo(() => displayNameFromTimeline(timeline, counterpartyName), [timeline, counterpartyName]);
  const headerAvatar = useMemo(() => headerAvatarFromTimeline(timeline, counterpartyAvatarUrl), [timeline, counterpartyAvatarUrl]);

  useEffect(() => {
    if (!selfId) return;
    let active = true;

    // Verificar si ya tenemos los datos en localStorage
    const cachedProfile = localStorage.getItem(`user_profile_${selfId}`);
    if (cachedProfile) {
      try {
        const { full_name, avatar_url, email, timestamp } = JSON.parse(cachedProfile);
        // Cache válida por 1 hora
        if (Date.now() - (timestamp || 0) < 3600000) {
          setSelfName((full_name || "").toString().trim() || null);
          setSelfEmail((email || "").toString().trim() || null);
          setSelfAvatarUrl((avatar_url || "").toString().trim() || null);
          return;
        }
      } catch {}
    }

    // Si no hay caché o es inválida, cargar desde la API
    (async () => {
      try {
        const [{ data: auth }, { data }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("profiles")
            .select("full_name,avatar_url")
            .eq("id", selfId)
            .single()
        ]);

        if (!active) return;

        const profileData = {
          full_name: (data?.full_name || "").toString().trim(),
          avatar_url: (data?.avatar_url || "").toString().trim(),
          email: (auth?.user?.id === selfId ? (auth?.user?.email || "") : "").toString().trim(),
          timestamp: Date.now()
        };

        // Actualizar estado
        setSelfName(profileData.full_name || null);
        setSelfEmail(profileData.email || null);
        setSelfAvatarUrl(profileData.avatar_url || null);

        // Guardar en caché
        try {
          localStorage.setItem(`user_profile_${selfId}`, JSON.stringify(profileData));
        } catch (e) {
          console.warn('No se pudo guardar en localStorage:', e);
        }
      } catch (error) {
        console.error('Error cargando perfil:', error);
      }
    })();

    return () => { active = false; };
  }, [supabase, selfId]);

  // Marcar conversación como leída
  const markAsRead = useCallback(async () => {
    if (!effectiveConversationId) return;
    if (markingReadRef.current) return;
    // Cooldown de 2s para evitar spam si hay múltiples triggers
    const now = Date.now();
    if (now - (lastReadPostAtRef.current || 0) < 2000) return;

    // Detectar el último mensaje entrante para no repetir lecturas sin novedades
    const latestIncoming = (() => {
      for (let i = timeline.length - 1; i >= 0; i--) {
        const it = timeline[i];
        if (it.type === "incoming") return it.id; // id "msg-<serverId>"
      }
      return null;
    })();
    // Si no hay mensajes entrantes, no hay nada que marcar como leído
    if (!latestIncoming) {
      return;
    }
    if (latestIncoming && lastReadIncomingKeyRef.current === latestIncoming) {
      return; // nada nuevo que marcar
    }
    try {
      markingReadRef.current = true;
      await markConversationRead(effectiveConversationId);
      // Forzar actualización del estado para reflejar el cambio
      setTimeline((prev) => [...prev]);
      try {
        onConversationRead?.(effectiveConversationId);
      } catch {}
      lastReadIncomingKeyRef.current = latestIncoming;
      lastReadPostAtRef.current = Date.now();
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    } finally {
      markingReadRef.current = false;
    }
  }, [effectiveConversationId, timeline, onConversationRead]);

  // Sincronizar ref con la función estable una vez definida
  useEffect(() => { markAsReadRef.current = markAsRead; }, [markAsRead]);

  // Marcar como leído solo cuando el usuario tiene visible la conversación y está al fondo
  const checkAndMarkIfAtBottom = useCallback(() => {
    try {
      if (document.visibilityState !== "visible") return;
      const el = scrollRef.current;
      if (!el) return;
      const threshold = 24; // px de tolerancia
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      // Actualizar estado de anclaje al fondo
      pinnedBottomRef.current = atBottom;
      if (atBottom) {
        if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
        readDebounceRef.current = setTimeout(() => {
          // No await para no bloquear UI
          markAsRead();
        }, 120);
      }
    } catch {}
  }, [markAsRead]);

  useEffect(() => {
    const el = scrollRef.current;
    // Intentar marcar si ya estamos al fondo (por ejemplo, tras auto-scroll inicial)
    checkAndMarkIfAtBottom();
    const onScroll = () => checkAndMarkIfAtBottom();
    const onVisibility = () => checkAndMarkIfAtBottom();
    el?.addEventListener("scroll", onScroll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
      el?.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effectiveConversationId, checkAndMarkIfAtBottom]);

  useEffect(() => {
    if (!effectiveConversationId) return;

    // Clave única para la caché de esta conversación
    const cacheKey = `conv_${effectiveConversationId}_${selfId}`;

    async function load() {
      setLoading(true);

      // Verificar caché primero (solo si es reciente, < 30 segundos)
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < 30000) { // 30 segundos de caché
            processMessages(data);
            return; // Usar caché y cargar en segundo plano
          }
        } catch {}
      }

      // Cargar desde la API
      fetchMessages();
    }

    async function fetchMessages() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10s

        const url = new URL(`/api/chat/conversations/${effectiveConversationId}/messages`, window.location.origin);
        url.searchParams.set("limit", "50");

        const msgRes = await fetch(url.toString(), { 
          cache: "no-store",
          signal: controller.signal 
        });

        clearTimeout(timeoutId);

        if (!msgRes.ok) throw new Error("Error al cargar historial");

        const msgData = await msgRes.json();
        const rows = Array.isArray(msgData?.messages) ? msgData.messages : [];

        // Guardar en caché
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: rows,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('No se pudo guardar en caché:', e);
        }

        processMessages(rows);

      } catch (e: any) {
        if (e.name !== 'AbortError') {
          toast.error(e?.message || "No se pudo cargar el historial");
          setLoading(false);
        }
      }
    }

    function processMessages(rows: any[]) {
      try {
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

        // Marcar mensajes como vistos
        tl.forEach((it) => seenRef.current.add(it.id));

      } catch (e) {
        console.error('Error procesando mensajes:', e);
        toast.error("Error al procesar los mensajes");
      } finally {
        setLoading(false);
      }
    }

    load();

    // Limpiar caché al desmontar
    return () => {
      try {
        // Limpiar caché antigua (> 1 hora)
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('conv_')) {
            try {
              const data = localStorage.getItem(key);
              if (data) {
                const { timestamp } = JSON.parse(data);
                if (Date.now() - timestamp > 3600000) { // 1 hora
                  localStorage.removeItem(key);
                }
              }
            } catch {}
          }
        });
      } catch {}
    };
  }, [effectiveConversationId, selfId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 24;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    if (pinnedBottomRef.current || lastOwnAppendRef.current || atBottom) {
      el.scrollTop = el.scrollHeight;
    }
    // Reset del flag: solo se usa para el siguiente render tras mensaje propio
    lastOwnAppendRef.current = false;
  }, [timeline]);

  useEffect(() => {
    try {
      timeline.forEach((it) => seenRef.current.add(it.id));
    } catch {}
  }, [timeline]);

  useEffect(() => {
    if (!effectiveConversationId) return;

    let disposed = false;
    const channelName = `private-conversation-${effectiveConversationId}`;
    let ch: any = null;
    let retryTimer: any = null;
    let retries = 0;

    let cleanup: () => void = () => {};

    const bindHandlers = () => {
      if (!ch) return;

      const onChatMessageNew = async (msg: any) => {
        const key = `msg-${msg?.id}`;
        if (seenRef.current.has(key)) return;
        const isIncoming = String(msg?.sender_id || "") !== String(selfId);
        setTimeline((prev) => {
          // Si el mensaje es propio (outgoing) reemplazamos el optimista temp- por el definitivo del servidor
          if (!isIncoming) {
            // Último agregado es propio → permitir un autoscroll
            lastOwnAppendRef.current = true;
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
                  sender_name: selfNameRef.current ?? it.sender_name,
                  sender_email: selfEmailRef.current ?? it.sender_email,
                  avatar_url: selfAvatarUrlRef.current ?? it.avatar_url,
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
                  sender_name: selfNameRef.current || undefined,
                  sender_email: selfEmailRef.current || undefined,
                  avatar_url: selfAvatarUrlRef.current || undefined,
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
            sender_name: msg?.sender_name ?? counterpartyNameRef.current ?? undefined,
            sender_email: msg?.sender_email ?? undefined,
            avatar_url: msg?.avatar_url ?? counterpartyAvatarUrlRef.current ?? undefined,
          });
          seenRef.current.add(key);
          return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        // Si la conversación está abierta y llega un mensaje entrante, marcar como leído con debounce
        if (isIncoming) {
          if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
          readDebounceRef.current = setTimeout(() => {
            // No await para no bloquear el handler de realtime
            try { markAsReadRef.current?.(); } catch {}
          }, 120);
        }
      };

      const onConvRead = (payload: any) => {
        try {
          const uid = String(payload?.user_id || "");
          if (uid && uid !== String(selfId)) {
            const at = String(payload?.last_read_at || new Date().toISOString());
            setLastReadAt(at);
          }
        } catch {}
      };

      const onTyping = (payload: any) => {
        try {
          const uid = String(payload?.user_id || "");
          if (uid && uid !== String(selfId)) {
            setIsTyping(Boolean(payload?.typing));
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (payload?.typing) {
              typingTimerRef.current = setTimeout(() => setIsTyping(false), 3500);
            }
          }
        } catch {}
      };

      ch.bind("chat:message:new", onChatMessageNew);
      ch.bind("chat:conversation:read", onConvRead);
      ch.bind("chat:typing", onTyping);

      cleanup = () => {
        try {
          ch.unbind("chat:message:new", onChatMessageNew);
          ch.unbind("chat:conversation:read", onConvRead);
          ch.unbind("chat:typing", onTyping);
          getPusherClient()?.unsubscribe(channelName);
        } catch {}
      };
    };

    const tryInit = () => {
      if (disposed) return;
      const client = getPusherClient();
      if (!client) {
        if (retries < 10) {
          retries += 1;
          retryTimer = setTimeout(tryInit, 800);
        }
        return;
      }
      ch = subscribePrivate(channelName);
      if (!ch) {
        if (retries < 10) {
          retries += 1;
          retryTimer = setTimeout(tryInit, 800);
        }
        return;
      }
      bindHandlers();
    };

    tryInit();

    return () => {
      disposed = true;
      try { if (retryTimer) clearTimeout(retryTimer); } catch {}
      try { cleanup(); } catch {}
    };
  }, [effectiveConversationId, selfId]);

  function handleSent(evt: ChatV2Sent) {
    const key = `msg-${evt.id}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    lastOwnAppendRef.current = true; // permitir autoscroll en el siguiente render
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
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full",
                  connState === "connected" ? "bg-emerald-500" :
                  (connState === "connecting" || connState === "unavailable") ? "bg-amber-500" :
                  "bg-red-500"
                )} />
                <span>
                  {connState === "connected" ? "Conectado" : (connState === "connecting" || connState === "unavailable") ? "Reconectando..." : "Desconectado"}
                </span>
              </div>
              {isTyping && (
                <div className="mt-0.5 text-xs text-muted-foreground italic">Escribiendo…</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onClose ? (
              <Button variant="ghost" size="icon" aria-label="Cerrar" title="Cerrar" onClick={() => { try { onClose(); } catch {} }}>
                <X className="h-5 w-5" />
              </Button>
            ) : null}
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
          ) : (
            <>
              {hasMoreOlder && timeline.length > 0 && (
                <div className="mb-2 flex justify-center">
                  <Button size="sm" variant="outline" onClick={loadOlder} disabled={loadingOlder}>
                    {loadingOlder ? "Cargando..." : "Cargar mensajes anteriores"}
                  </Button>
                </div>
              )}
              {timeline.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No hay mensajes en esta conversación.</div>
              ) : (
                <ChatMessages items={timeline} lastReadAt={lastReadAt ?? undefined} />
              )}
            </>
          )}
        </div>
        <div className="border-t p-3">
          <ConversationChatInput conversationId={effectiveConversationId} onSent={handleSent} />
        </div>
      </div>
    </div>
  );
}
