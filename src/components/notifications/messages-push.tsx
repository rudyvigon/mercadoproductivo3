"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { getPusherClient, subscribePrivate, onConnectionStateChange, safeUnsubscribe } from "@/lib/pusher/client";
import { registerAndSubscribePush } from "@/lib/push/register";
import { useMessagesNotifications } from "@/store/messages-notifications";
import { toast } from "sonner";
import { ConvUpdateEventSchema, MessageNewEventSchema } from "@/lib/chat/events";
import { flushOutbox, setupOutboxAutoFlush } from "@/lib/chat/offline-queue";

const LOCKS_KEY = "__mp_msg_push__locks__";
function getPushLocks(): Record<string, { owner: symbol | null }> {
  const g: any = globalThis as any;
  g[LOCKS_KEY] = g[LOCKS_KEY] || {};
  return g[LOCKS_KEY];
}

function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 10000, ...rest } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(t));
}

export default function MessagesPush({ sellerId, messagesHref }: { sellerId?: string | null; messagesHref?: string }) {
  const { unreadCount, setUnreadCount, setRecent, bumpUnread, prependRecent } = useMessagesNotifications();
  const pathname = usePathname();
  const lastToastRef = useRef<Record<string, number>>({}); // convId -> timestamp
  const profileCacheRef = useRef<Record<string, { name?: string | null }>>({}); // userId -> cached minimal profile
  const PENDING_KEY = "mp:pending-unread";
  const instanceTokenRef = useRef<symbol>(Symbol("MessagesPush"));
  const soundPrefRef = useRef<boolean>(true);
  const requestedNotifRef = useRef<boolean>(false);

  // Inicializar preferencia de sonido desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mp:notify:sound");
      if (raw != null) soundPrefRef.current = raw === "1";
    } catch {}
  }, []);

  

  // Beep simple (WebAudio) como feedback opcional
  const playBeep = useCallback(() => {
    try {
      if (!soundPrefRef.current) return;
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 880;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      osc.start();
      osc.stop(now + 0.15);
      setTimeout(() => { try { ctx.close(); } catch {} }, 250);
    } catch {}
  }, []);

  // Pedir permiso de notificación nativa (una sola vez por sesión)
  const ensureNotificationPermission = useCallback(async () => {
    try {
      if (typeof window === "undefined" || typeof Notification === "undefined") return false;
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      if (requestedNotifRef.current) return false;
      requestedNotifRef.current = true;
      const perm = await Notification.requestPermission().catch(() => "default");
      return perm === "granted";
    } catch { return false; }
  }, []);

  const showNativeNotification = useCallback(async (title: string, body: string) => {
    try {
      if (typeof window === "undefined" || typeof Notification === "undefined") return false;
      const can = Notification.permission === "granted" || (await ensureNotificationPermission());
      if (!can) return false;
      const n = new Notification(title || "Nuevo mensaje", { 
        body, 
        tag: "mp-chat",
        // @ts-ignore - renotify is not in the type definition but is supported in browsers
        renotify: true 
      } as NotificationOptions);
      n.onclick = () => {
        try { window.focus(); window.location.href = messagesHref || "/dashboard/messages"; } catch {}
        try { n.close(); } catch {}
      };
      return true;
    } catch { return false; }
  }, [ensureNotificationPermission, messagesHref]);

  const incPendingUnread = useCallback((convId: string) => {
    try {
      if (!convId || typeof window === "undefined") return;
      const raw = localStorage.getItem(PENDING_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const curr = map[convId] || { delta: 0, last_at: null };
      map[convId] = { delta: Math.max(0, Number(curr.delta) || 0) + 1, last_at: new Date().toISOString() };
      localStorage.setItem(PENDING_KEY, JSON.stringify(map));
    } catch {}
  }, []);

  const onMessagesPage = useMemo(() => {
    try {
      const href = messagesHref || "/dashboard/messages";
      return pathname?.startsWith(href);
    } catch {
      return false;
    }
  }, [pathname, messagesHref]);

  const refreshInboxSnapshot = useCallback(async (opts?: { monotonic?: boolean }) => {
    if (onMessagesPage) return;
    try {
      const res = await fetchWithTimeout("/api/chat/inbox-snapshot", { timeoutMs: 10000 });
      if (!res.ok) throw new Error("inbox fetch failed");
      const data = await res.json();
      const { unread_count, recent_threads } = data;
      if (opts?.monotonic) {
        // Leer el valor actual desde el store para evitar cierres obsoletos
        const prev = (useMessagesNotifications as any).getState().unreadCount as number;
        setUnreadCount(Math.max(prev, unread_count || 0));
      } else {
        setUnreadCount(unread_count || 0);
      }
      if (Array.isArray(recent_threads)) {
        setRecent(recent_threads);
      }
    } catch {}
  }, [onMessagesPage, setUnreadCount, setRecent]);

  // Refresco periódico global (30s) incluso si no hay sellerId (por ejemplo, compradores)
  useEffect(() => {
    if (onMessagesPage) return;
    const id = setInterval(() => {
      try { refreshInboxSnapshot({ monotonic: true }); } catch {}
    }, 30000);
    return () => { try { clearInterval(id); } catch {} };
  }, [onMessagesPage, refreshInboxSnapshot]);

  const getCounterpartyName = useCallback(
    async (evt: any): Promise<string> => {
      const inline = String(
        evt?.counterparty_name || evt?.sender_name || evt?.title || evt?.topic || ""
      )
        .toString()
        .trim();
      if (inline) return inline;

      const uid = String(evt?.counterparty_id || evt?.user_id || evt?.owner_id || "").trim();
      if (!uid) return "Usuario";

      const cached = profileCacheRef.current[uid];
      if (cached && (cached.name || cached.name === null)) {
        return cached.name || "Usuario";
      }

      try {
        const r = await fetchWithTimeout(`/api/public/sellers/${encodeURIComponent(uid)}`, {
          cache: "force-cache",
          next: { revalidate: 3600 },
          timeoutMs: 8000,
        } as any);
        if (!r.ok) throw new Error("profile fetch failed");
        const j = await r.json();
        const prof = j?.seller || {};
        const company = String(prof?.company || "").trim();
        const full = String(prof?.full_name || "").trim();
        const name = company || full || "Usuario";
        profileCacheRef.current[uid] = { name };
        return name;
      } catch {
        profileCacheRef.current[uid] = { name: null };
        return "Usuario";
      }
    },
    []
  );

  const onConvUpdated = useCallback(async (raw: any) => {
    const parsed = ConvUpdateEventSchema.safeParse(raw);
    if (!parsed.success) return;
    const evt = parsed.data;
    if (onMessagesPage) return;
    setTimeout(() => {
      try { refreshInboxSnapshot({ monotonic: true }); } catch {}
    }, 350);
    const convId = String(evt.conversation_id || "");
    if (!convId) return;
    // Incremento inmediato para reflejar el nuevo mensaje en el badge,
    // ya que en este canal no recibimos siempre el evento chat:message:new
    try { bumpUnread(1); } catch {}
    try { incPendingUnread(convId); } catch {}
    const now = Date.now();
    const last = lastToastRef.current[convId] || 0;
    if (now - last < 6000) return;
    lastToastRef.current[convId] = now;
    const name = await getCounterpartyName(evt);
    const body = String(evt.preview || evt.message_text || "Nuevo mensaje");
    // Notificación nativa si la pestaña no está visible
    try {
      if (document.visibilityState !== "visible") {
        const shown = await showNativeNotification(name, body);
        if (!shown) playBeep();
      } else {
        playBeep();
      }
    } catch {}
    try {
      const recentItem = {
        id: convId,
        created_at: new Date().toISOString(),
        seller_id: String(evt.owner_id ?? sellerId ?? ""),
        sender_name: name,
        subject: body,
        body: undefined as string | undefined,
      };
      prependRecent(recentItem);
    } catch {}
    toast.custom((t) => (
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-background p-3 shadow-lg">
        <div className="flex-1 text-sm">
          <div className="font-medium">Nuevo mensaje</div>
          <div className="text-muted-foreground">{name}</div>
        </div>
        <button
          onClick={() => { try { window.location.href = messagesHref || "/dashboard/messages"; } catch {}; toast.dismiss(t); }}
          className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-white"
          style={{ backgroundColor: "#f06d04" }}
        >
          Ver mensajes
        </button>
      </div>
    ), { duration: 4500 });
  }, [onMessagesPage, refreshInboxSnapshot, getCounterpartyName, prependRecent, messagesHref, sellerId]);

  const onMessageNew = useCallback(async (raw: any) => {
    const parsed = MessageNewEventSchema.safeParse(raw);
    if (!parsed.success) {
      try { refreshInboxSnapshot({ monotonic: true }); } catch {}
      return;
    }
    const evt = parsed.data;
    if (onMessagesPage) return;
    const convId = String(evt.conversation_id || "");
    if (!convId) {
      try { refreshInboxSnapshot({ monotonic: true }); } catch {}
      return;
    }
    try { refreshInboxSnapshot({ monotonic: true }); } catch {}
    const now = Date.now();
    const last = lastToastRef.current[convId] || 0;
    if (now - last < 6000) return;
    lastToastRef.current[convId] = now;
    const name = await getCounterpartyName(evt);
    const body = String(evt.preview || evt.body || "Nuevo mensaje");
    // Notificación nativa y beep
    try {
      if (document.visibilityState !== "visible") {
        const shown = await showNativeNotification(name, body);
        if (!shown) playBeep();
      } else {
        playBeep();
      }
    } catch {}
    try { bumpUnread(1); } catch {}
    try { incPendingUnread(convId); } catch {}
    try {
      const recentItem = {
        id: convId,
        created_at: new Date().toISOString(),
        seller_id: String(evt.owner_id ?? sellerId ?? ""),
        sender_name: name,
        subject: body,
        body: undefined as string | undefined,
      };
      prependRecent(recentItem);
    } catch {}
    toast.custom((t) => (
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-background p-3 shadow-lg">
        <div className="flex-1 text-sm">
          <div className="font-medium">{name}</div>
          <div className="text-muted-foreground">{body}</div>
        </div>
        <button
          onClick={() => { try { window.location.href = messagesHref || "/dashboard/messages"; } catch {}; toast.dismiss(t); }}
          className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-white"
          style={{ backgroundColor: "#f06d04" }}
        >
          Ver mensajes
        </button>
      </div>
    ), { duration: 4500 });
  }, [onMessagesPage, refreshInboxSnapshot, getCounterpartyName, bumpUnread, incPendingUnread, prependRecent, messagesHref, sellerId]);

  const onConvSimpleUpdate = useCallback(async (_evt: any) => {
    await refreshInboxSnapshot();
  }, [refreshInboxSnapshot]);

  useEffect(() => {
    if (onMessagesPage) return;
    try { refreshInboxSnapshot({ monotonic: true }); } catch {}
  }, [refreshInboxSnapshot, onMessagesPage]);

  useEffect(() => {
    if (!sellerId || onMessagesPage) return;
    let timer: any;
    const tick = async () => {
      try {
        if (document.visibilityState === "visible") {
          await refreshInboxSnapshot({ monotonic: true });
        }
      } catch {}
      timer = setTimeout(tick, 20000);
    };
    timer = setTimeout(tick, 20000);
    return () => { try { clearTimeout(timer); } catch {} };
  }, [sellerId, onMessagesPage, refreshInboxSnapshot]);

  useEffect(() => {
    if (!sellerId) return;

    const channelName = `private-user-${sellerId}`;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 6;
    const scheduleRetry = () => {
      if (attempts >= maxAttempts) return;
      const base = 1000 * Math.pow(2, attempts);
      const jitter = Math.floor(Math.random() * 500);
      const delay = Math.min(30000, base) + jitter;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(tryInit, delay);
    };

    const tryInit = () => {
      try {
        const locks = getPushLocks();
        if (!locks[channelName]) {
          locks[channelName] = { owner: null };
        }
        const entry = locks[channelName];
        if (entry.owner && entry.owner !== instanceTokenRef.current) {
          attempts = Math.min(attempts + 1, maxAttempts);
          scheduleRetry();
          return;
        }
        entry.owner = instanceTokenRef.current;

        const ch = subscribePrivate(channelName);
        if (!ch) {
          attempts = Math.min(attempts + 1, maxAttempts);
          scheduleRetry();
          return;
        }

        ch.bind("pusher:subscription_succeeded", () => {
          if (retryTimer) clearTimeout(retryTimer);
          attempts = 0;
        });

        ch.bind("pusher:subscription_error", (status: any) => {
          if (status === 403) { 
            if (retryTimer) clearTimeout(retryTimer);
            return;
          }
          attempts = Math.min(attempts + 1, maxAttempts);
          scheduleRetry();
        });

        const bindHandlers = () => {
          if (!ch) return;

          ch.bind("chat:conversation:updated", onConvUpdated);
          ch.bind("chat:conversation:started", onConvSimpleUpdate);
          ch.bind("chat:conversation:hidden", onConvSimpleUpdate);
          ch.bind("chat:conversation:restored", onConvSimpleUpdate);
          ch.bind("chat:conversation:read", onConvSimpleUpdate);
          ch.bind("chat:message:new", onMessageNew);

          cleanup = () => {
            try {
              ch.unbind("chat:conversation:updated", onConvUpdated);
              ch.unbind("chat:conversation:started", onConvSimpleUpdate);
              ch.unbind("chat:conversation:hidden", onConvSimpleUpdate);
              ch.unbind("chat:conversation:restored", onConvSimpleUpdate);
              ch.unbind("chat:conversation:read", onConvSimpleUpdate);
              ch.unbind("chat:message:new", onMessageNew);
              safeUnsubscribe(channelName);
            } catch {}
          };
        };

        bindHandlers();
      } catch {}
    };

    let cleanup: () => void = () => {};
    tryInit();

    return () => {
      try { if (retryTimer) clearTimeout(retryTimer); } catch {}
      try { cleanup(); } catch {}
      try {
        const locks = getPushLocks();
        const entry = locks[channelName];
        if (entry && entry.owner === instanceTokenRef.current) {
          entry.owner = null;
        }
      } catch {}
    };
  }, [sellerId, onConvUpdated, onMessageNew, onConvSimpleUpdate]);

  // Re-sincronizar cuando la pestaña vuelva a estar activa (fuera de /messages, no monótonico)
  useEffect(() => {
    const onVis = () => {
      try {
        if (document.visibilityState === "visible" && !onMessagesPage) {
          refreshInboxSnapshot({ monotonic: true });
        }
      } catch {}
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshInboxSnapshot, onMessagesPage]);

  // Auto-flush de outbox al reconectar o al volver online
  useEffect(() => {
    const disposeOnline = setupOutboxAutoFlush();
    const off = onConnectionStateChange((state) => {
      if (state === "connected") {
        try { void flushOutbox(10); } catch {}
      }
    });
    // Flush inicial suave
    try { void flushOutbox(5); } catch {}
    return () => {
      try { off?.(); } catch {}
      try { disposeOnline?.(); } catch {}
    };
  }, []);

  // Registrar Service Worker y suscribirse a Web Push (si hay permisos)
  useEffect(() => {
    try { void registerAndSubscribePush(); } catch {}
  }, []);

  return null;
}
