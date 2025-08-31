"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPusherClient, subscribePrivate } from "@/lib/pusher/client";
import { useMessagesNotifications } from "@/store/messages-notifications";
import SellerConversationPanel from "@/components/chat/seller-conversation-panel";
import { normalizeAvatarUrl, initialFrom, type PublicProfile } from "@/lib/user-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export type ChatV2Conversation = {
  id: string;
  counterparty_id?: string | null;
  counterparty_name?: string | null;
  counterparty_avatar_url?: string | null;
  last_created_at?: string | null;
  preview?: string | null;
  unread_count?: number | null;
  hidden_at?: string | null;
};

// Nueva lógica local: nombre preferido y avatar
function nameFromProfileLocal(p?: Partial<PublicProfile> | null, fallback?: string | null): string {
  const company = (p?.company || "").toString().trim();
  if (company) return company;
  const full = (p?.full_name || "").toString().trim();
  if (full) return full;
  const first = (p?.first_name || "").toString().trim();
  const last = (p?.last_name || "").toString().trim();
  const composed = [first, last].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  const fb = (fallback || "").toString().trim();
  return fb;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso || "—";
  }
}

// Hook de media query local (evita redefinir en cada render)
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const m = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(m.matches);
    try {
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    } catch {
      // @ts-ignore - Safari legacy
      m.addListener(onChange);
      return () => {
        try {
          // @ts-ignore
          m.removeListener(onChange);
        } catch {}
      };
    }
  }, [query]);
  return matches;
}

export default function MessagesInboxV2({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<"inbox" | "hidden">("inbox");
  const [q, setQ] = useState("");

  // Scroll infinito: cantidad visible por pestaña
  const BASE_CHUNK = 20;
  const [visibleCount, setVisibleCount] = useState(BASE_CHUNK);
  const [hiddenCount, setHiddenCount] = useState(BASE_CHUNK);

  const [loading, setLoading] = useState(false);
  const [itemsAll, setItemsAll] = useState<ChatV2Conversation[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PublicProfile>>({});
  const [fallbackByConvId, setFallbackByConvId] = useState<Record<string, { name?: string | null; avatar?: string | null }>>({});

  // Evitar que cambios en profilesById re-generen el callback y disparen recargas en bucle
  const profilesRef = useRef(profilesById);
  useEffect(() => {
    profilesRef.current = profilesById;
  }, [profilesById]);

  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [chatName, setChatName] = useState<string | null>(null);
  const [chatAvatar, setChatAvatar] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const sheetContentRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);

  const { setUnreadCount } = useMessagesNotifications();

  const visible = useMemo(() => itemsAll.filter((c) => !c.hidden_at), [itemsAll]);
  const hidden = useMemo(() => itemsAll.filter((c) => !!c.hidden_at), [itemsAll]);

  const filteredVisible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visible;
    return visible.filter((c) => {
      const profile = c.counterparty_id ? profilesById[c.counterparty_id] : undefined;
      const baseName = nameFromProfileLocal(profile, c.counterparty_name || undefined);
      const name = (baseName || fallbackByConvId[c.id]?.name || "—").toLowerCase();
      const prev = (c.preview || "").toLowerCase();
      return name.includes(term) || prev.includes(term);
    });
  }, [visible, q, profilesById, fallbackByConvId]);

  const filteredHidden = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return hidden;
    return hidden.filter((c) => {
      const profile = c.counterparty_id ? profilesById[c.counterparty_id] : undefined;
      const baseName = nameFromProfileLocal(profile, c.counterparty_name || undefined);
      const name = (baseName || fallbackByConvId[c.id]?.name || "—").toLowerCase();
      const prev = (c.preview || "").toLowerCase();
      return name.includes(term) || prev.includes(term);
    });
  }, [hidden, q, profilesById, fallbackByConvId]);

  const sortedVisible = useMemo(
    () =>
      [...filteredVisible].sort(
        (a, b) => new Date(b.last_created_at || 0).getTime() - new Date(a.last_created_at || 0).getTime()
      ),
    [filteredVisible]
  );
  const sortedHidden = useMemo(
    () =>
      [...filteredHidden].sort(
        (a, b) => new Date(b.last_created_at || 0).getTime() - new Date(a.last_created_at || 0).getTime()
      ),
    [filteredHidden]
  );

  // Slices para scroll infinito
  const visibleSlice = useMemo(() => sortedVisible.slice(0, visibleCount), [sortedVisible, visibleCount]);
  const hiddenSlice = useMemo(() => sortedHidden.slice(0, hiddenCount), [sortedHidden, hiddenCount]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations?includeHidden=true`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || j?.error || "No se pudo cargar la bandeja");
      const list: ChatV2Conversation[] = Array.isArray(j?.conversations) ? j.conversations : [];
      setItemsAll(list);
      // Pre-poblar perfiles mínimos con datos de la conversación para evitar "—" en el listado
      if (list.length > 0) {
        setProfilesById((prev) => {
          const next = { ...prev } as Record<string, PublicProfile>;
          for (const c of list) {
            const id = c.counterparty_id;
            if (!id) continue;
            if (!next[id]) {
              const fullName = (c.counterparty_name || "").toString().trim() || undefined;
              const avatarUrl = (c.counterparty_avatar_url || "").toString().trim() || undefined;
              next[id] = {
                id,
                full_name: fullName,
                avatar_url: avatarUrl,
              } as PublicProfile;
            }
          }
          return next;
        });
      }
      // Enriquecer perfiles públicos faltantes por counterparty_id
      const ids = Array.from(
        new Set(
          list
            .map((c) => c.counterparty_id)
            .filter((id): id is string => Boolean(id) && !profilesRef.current[id as string])
        )
      );
      if (ids.length > 0) {
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const r = await fetch(`/api/public/sellers/${encodeURIComponent(id)}`, { cache: "no-store" });
              const jj = await r.json();
              if (!r.ok) return { id, profile: undefined } as { id: string; profile?: PublicProfile };
              return { id, profile: jj?.seller as PublicProfile };
            } catch {
              return { id, profile: undefined } as { id: string; profile?: PublicProfile };
            }
          })
        );
        const updates: Record<string, PublicProfile> = {};
        for (const it of results) {
          if (it.profile) updates[it.id] = it.profile;
        }
        if (Object.keys(updates).length > 0) {
          setProfilesById((prev) => ({ ...prev, ...updates }));
        }
      }
      // Fallback adicional: obtener nombre y avatar desde el ÚLTIMO mensaje entrante cuando falte nombre o avatar
      const needFallbackIds = list
        .filter((c) => !String(c.counterparty_name || "").trim() || !String(c.counterparty_avatar_url || "").trim())
        .map((c) => c.id);
      if (needFallbackIds.length > 0) {
        const out = await Promise.all(
          needFallbackIds.map(async (cid) => {
            try {
              const r = await fetch(`/api/chat/conversations/${encodeURIComponent(cid)}/messages?limit=50`, { cache: "no-store" });
              const jj = await r.json();
              if (!r.ok) return { cid } as { cid: string; name?: string; avatar?: string };
              const arr = Array.isArray(jj?.messages) ? (jj.messages as any[]) : [];
              const lastIncoming = [...arr].reverse().find((m) => String(m?.sender_id || "") !== String(userId));
              const name = (lastIncoming?.sender_name || "").toString().trim();
              const avatar = normalizeAvatarUrl(lastIncoming?.avatar_url) || undefined;
              if (!name && !avatar) return { cid } as { cid: string; name?: string; avatar?: string };
              return { cid, name, avatar } as { cid: string; name?: string; avatar?: string };
            } catch {
              return { cid } as { cid: string; name?: string; avatar?: string };
            }
          })
        );
        const updates: Record<string, { name?: string | null; avatar?: string | null }> = {};
        for (const it of out) {
          if (it.name || it.avatar) updates[it.cid] = { name: it.name || null, avatar: it.avatar || null };
        }
        if (Object.keys(updates).length > 0) {
          setFallbackByConvId((prev) => ({ ...prev, ...updates }));
        }
      }
      // no leídos visibles
      const unread = list.filter((c) => !c.hidden_at).reduce((acc, it) => acc + (Number(it.unread_count || 0) || 0), 0);
      setUnreadCount(unread);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar conversaciones");
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount, userId]);

  // Optimista: cuando el panel marca la conversación como leída, reflejarlo en la lista sin esperar al refresh
  const onConversationRead = useCallback(
    (conversationId: string) => {
      if (!conversationId) return;
      let updated: ChatV2Conversation[] = [];
      setItemsAll((prev) => {
        updated = prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c));
        return updated;
      });
      try {
        const unread = updated
          .filter((c) => !c.hidden_at)
          .reduce((acc, it) => acc + (Number(it.unread_count || 0) || 0), 0);
        setUnreadCount(unread);
      } catch {}
    },
    [setUnreadCount]
  );

  useEffect(() => {
    const t = setTimeout(refresh, 100);
    return () => clearTimeout(t);
    // Llamar una vez por usuario; evitar depender de `refresh` para no entrar en bucles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Realtime: canal del usuario
  useEffect(() => {
    if (!userId) return;
    
    const client = getPusherClient();
    if (!client) return;
    
    const channelName = `private-user-${userId}`;
    const ch = subscribePrivate(channelName);
    if (!ch) return;

    // Incremento inmediato de no leídos cuando hay nueva actividad en una conversación (evento emitido solo a los otros miembros)
    const onConvUpdated = (evt: any) => {
      const cid = evt?.conversation_id as string | undefined;
      if (!cid) {
        // Si no llega el id, caemos a un refresh completo
        refresh();
        return;
      }
      setItemsAll((prev) => {
        const exists = prev.some((c) => c.id === cid);
        if (!exists) {
          // Nueva conversación o aún no cargada: refrescar
          setTimeout(() => refresh(), 0);
          return prev;
        }
        const updated = prev.map((conv) => {
          if (conv.id !== cid) return conv;
          // Si la conversación está abierta, no incrementar no leídos; solo auto-unhide
          if (chatConversationId && String(chatConversationId) === String(cid)) {
            return { ...conv, hidden_at: null, unread_count: 0 };
          }
          // Incremento normal para conversaciones no abiertas
          return { ...conv, unread_count: (Number(conv.unread_count) || 0) + 1, hidden_at: null };
        });
        const totalUnread = updated
          .filter((c) => !c.hidden_at)
          .reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0);
        setUnreadCount(totalUnread);
        return updated;
      });
    };

    // Cambios estructurales: refrescar listado
    const onConvStarted = async (_evt: any) => {
      await refresh();
    };
    const onConvHidden = async (_evt: any) => {
      await refresh();
    };
    const onConvRestored = async (_evt: any) => {
      await refresh();
    };

    // Manejar conversación marcada como leída
    const onRead = (evt: any) => {
      const cid = evt?.conversation_id as string | undefined;
      if (!cid) return;
      onConversationRead(cid);
    };

    // Bind events
    ch.bind("chat:conversation:updated", onConvUpdated);
    ch.bind("chat:conversation:started", onConvStarted);
    ch.bind("chat:conversation:hidden", onConvHidden);
    ch.bind("chat:conversation:restored", onConvRestored);
    ch.bind("chat:conversation:read", onRead);

    return () => {
      try {
        // Unbind all events
        ch.unbind("chat:conversation:updated", onConvUpdated);
        ch.unbind("chat:conversation:started", onConvStarted);
        ch.unbind("chat:conversation:hidden", onConvHidden);
        ch.unbind("chat:conversation:restored", onConvRestored);
        ch.unbind("chat:conversation:read", onRead);
        getPusherClient()?.unsubscribe(channelName);
      } catch (error) {
        console.error("Error cleaning up Pusher:", error);
      }
    };
  }, [userId, chatConversationId, refresh, onConversationRead, setUnreadCount]);

  // Nota: ocultar conversación desde la lista se removió (kebab eliminado). 
  // La acción de ocultar se mantiene en el header del panel de conversación.

  async function restoreConversation(id: string) {
    try {
      const res = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}/hide`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || j?.error || "No se pudo restaurar");
      toast.success("Conversación restaurada");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Error al restaurar la conversación");
    }
  }

  function openChat(c: ChatV2Conversation) {
    setChatConversationId(c.id);
    const prof = c.counterparty_id ? profilesById[c.counterparty_id] : undefined;
    // Resolver localmente: perfil -> conversación -> último mensaje entrante (fallback)
    const baseName = nameFromProfileLocal(prof, c.counterparty_name || undefined);
    const name = baseName || fallbackByConvId[c.id]?.name || null;
    const avatar =
      normalizeAvatarUrl(prof?.avatar_url) ||
      normalizeAvatarUrl(c.counterparty_avatar_url) ||
      normalizeAvatarUrl(fallbackByConvId[c.id]?.avatar) ||
      null;
    setChatName(name);
    setChatAvatar(avatar);
  }

  // Gesto de arrastre para cerrar el sheet en móvil (drag handle)
  useEffect(() => {
    if (!isMobile) return;
    const el = sheetContentRef.current;
    const handle = dragHandleRef.current;
    if (!el || !handle) return;

    let startY = 0;
    let currentY = 0;
    let dragging = false;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      startY = e.clientY;
      currentY = 0;
      el.style.willChange = "transform";
      el.style.transition = "none";
      try { handle.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      currentY = Math.max(e.clientY - startY, 0);
      el.style.transform = `translateY(${currentY}px)`;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      const threshold = Math.min(el.clientHeight * 0.25, 180);
      el.style.transition = "transform 200ms ease";
      if (currentY > threshold) {
        // Cerrar: limpiar estado
        setChatConversationId(null);
        setChatName(null);
        setChatAvatar(null);
        // Reset visual para próxima apertura
        setTimeout(() => {
          el.style.transform = "";
          el.style.transition = "";
          el.style.willChange = "";
        }, 220);
      } else {
        // Volver a posición inicial
        el.style.transform = "translateY(0px)";
        setTimeout(() => {
          el.style.transition = "";
          el.style.willChange = "";
        }, 220);
      }
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    };

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    return () => {
      handle.removeEventListener("pointerdown", onDown);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
  }, [isMobile]);

  // Resetear cantidad al cambiar búsqueda o listas
  useEffect(() => {
    setVisibleCount(BASE_CHUNK);
    setHiddenCount(BASE_CHUNK);
  }, [q]);

  useEffect(() => {
    setVisibleCount((c) => Math.min(Math.max(BASE_CHUNK, c), sortedVisible.length));
  }, [sortedVisible.length]);
  useEffect(() => {
    setHiddenCount((c) => Math.min(Math.max(BASE_CHUNK, c), sortedHidden.length));
  }, [sortedHidden.length]);

  // Refs para IntersectionObserver
  const inboxViewportRef = useRef<HTMLDivElement | null>(null);
  const inboxSentinelRef = useRef<HTMLDivElement | null>(null);
  const hiddenViewportRef = useRef<HTMLDivElement | null>(null);
  const hiddenSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = inboxViewportRef.current;
    const target = inboxSentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + BASE_CHUNK, sortedVisible.length));
          }
        }
      },
      { root, rootMargin: "0px 0px 200px 0px", threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [sortedVisible.length]);

  useEffect(() => {
    const root = hiddenViewportRef.current;
    const target = hiddenSentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setHiddenCount((prev) => Math.min(prev + BASE_CHUNK, sortedHidden.length));
          }
        }
      },
      { root, rootMargin: "0px 0px 200px 0px", threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [sortedHidden.length]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-5 lg:col-span-4 space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="inbox">Bandeja</TabsTrigger>
          <TabsTrigger value="hidden">Ocultas</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setVisibleCount(BASE_CHUNK);
                  setHiddenCount(BASE_CHUNK);
                }}
                placeholder="Buscar por nombre o mensaje..."
                className="max-w-md"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}>
                {loading ? "Cargando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <ScrollArea className="h-[60vh]" viewportRef={inboxViewportRef}>
              <div className="h-full">
                {visibleSlice.length === 0 && (
                  <div className="px-3 py-6 text-sm text-muted-foreground">No hay conversaciones.</div>
                )}
                {visibleSlice.map((c) => {
                  const prof = c.counterparty_id ? profilesById[c.counterparty_id] : undefined;
                  const baseName = nameFromProfileLocal(prof, c.counterparty_name || undefined);
                  const name = baseName || fallbackByConvId[c.id]?.name || "";
                  const avatar =
                    normalizeAvatarUrl(prof?.avatar_url) ||
                    normalizeAvatarUrl(c.counterparty_avatar_url) ||
                    normalizeAvatarUrl(fallbackByConvId[c.id]?.avatar);
                  const unread = Number(c.unread_count || 0) || 0;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 hover:bg-muted/40 border-b cursor-pointer",
                        unread > 0 && "bg-emerald-50/60",
                        chatConversationId === c.id && "bg-primary/5"
                      )}
                      onClick={() => openChat(c)}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={avatar} alt={name || "Usuario"} />
                        <AvatarFallback>{initialFrom(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium">{name || "—"}</div>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{c.preview || "—"}</div>
                      </div>
                      {unread > 0 ? (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                          {unread}
                        </span>
                      ) : (
                        <div className="w-5" />
                      )}
                    </div>
                  );
                })}
                {/* Sentinel para cargar más */}
                <div ref={inboxSentinelRef} className="h-4" />
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="hidden" className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Conversaciones ocultas</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}>
                {loading ? "Cargando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <ScrollArea className="h-[60vh]" viewportRef={hiddenViewportRef}>
              <div>
                {hiddenSlice.length === 0 && (
                  <div className="px-3 py-6 text-sm text-muted-foreground">No hay conversaciones ocultas.</div>
                )}
                {hiddenSlice.map((c) => {
                  const prof = c.counterparty_id ? profilesById[c.counterparty_id] : undefined;
                  const baseName = nameFromProfileLocal(prof, c.counterparty_name || undefined);
                  const name = baseName || fallbackByConvId[c.id]?.name || "";
                  const avatar =
                    normalizeAvatarUrl(prof?.avatar_url) ||
                    normalizeAvatarUrl(c.counterparty_avatar_url) ||
                    normalizeAvatarUrl(fallbackByConvId[c.id]?.avatar);
                  const unread = Number(c.unread_count || 0) || 0;
                  return (
                    <div
                      key={`hidden-${c.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 hover:bg-muted/40 border-b",
                        unread > 0 && "bg-emerald-50/60"
                      )}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={avatar} alt={name || "Usuario"} />
                        <AvatarFallback>{initialFrom(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium">{name || "—"}</div>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{c.preview || "—"}</div>
                      </div>
                      {unread > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                          {unread}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await restoreConversation(c.id);
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
                  );
                })}
                <div ref={hiddenSentinelRef} className="h-4" />
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>

      {!isMobile && (
        <div className="col-span-12 md:col-span-7 lg:col-span-8">
          <div className="h-[75vh] rounded-md border bg-background">
            {chatConversationId ? (
              <SellerConversationPanel
                conversationId={chatConversationId}
                selfId={userId}
                counterpartyName={chatName || undefined}
                counterpartyAvatarUrl={chatAvatar || undefined}
                onConversationRead={onConversationRead}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Selecciona una conversación para comenzar
              </div>
            )}
          </div>
        </div>
      )}

      {isMobile && (
        <Sheet
          open={!!chatConversationId}
          onOpenChange={(open) => {
            if (!open) {
              setChatConversationId(null);
              setChatName(null);
              setChatAvatar(null);
            }
          }}
        >
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0" ref={sheetContentRef}>
            <div className="flex flex-col h-full">
              {/* Drag handle */}
              <div className="flex items-center justify-center pt-2 pb-1">
                <div ref={dragHandleRef} className="h-1.5 w-12 rounded-full bg-muted-foreground/30" aria-label="Desliza hacia abajo para cerrar" />
              </div>
              <div className="min-h-0 flex-1">
                {chatConversationId ? (
                  <SellerConversationPanel
                    conversationId={chatConversationId}
                    selfId={userId}
                    counterpartyName={chatName || undefined}
                    counterpartyAvatarUrl={chatAvatar || undefined}
                    onConversationRead={onConversationRead}
                  />
                ) : null}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
