"use client";

// Cola offline simple basada en localStorage.
// Soporta dos tipos de ítems:
// - start_conversation: requiere iniciar conversación (participantId) y luego enviar el mensaje
// - conversation_message: enviar mensaje a una conversación existente (conversationId)

export type OutboxItem = {
  id: string;
  type: "start_conversation" | "conversation_message";
  participantId?: string;
  conversationId?: string;
  body: string;
  created_at: string;
};

const OUTBOX_KEY = "mp:outbox:v1";

function readOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {}
}

function genId(): string {
  return `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueStartConversation(participantId: string, body: string): OutboxItem {
  const item: OutboxItem = {
    id: genId(),
    type: "start_conversation",
    participantId,
    body,
    created_at: new Date().toISOString(),
  };
  const items = readOutbox();
  items.push(item);
  writeOutbox(items);
  return item;
}

export function enqueueConversationMessage(conversationId: string, body: string): OutboxItem {
  const item: OutboxItem = {
    id: genId(),
    type: "conversation_message",
    conversationId,
    body,
    created_at: new Date().toISOString(),
  };
  const items = readOutbox();
  items.push(item);
  writeOutbox(items);
  return item;
}

export function isOutboxEmpty(): boolean {
  return readOutbox().length === 0;
}

async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 10000, ...rest } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// Procesa hasta maxPerFlush ítems de la outbox. Devuelve cantidad procesada satisfactoriamente.
export async function flushOutbox(maxPerFlush = 10): Promise<number> {
  if (typeof window === "undefined") return 0;
  let okCount = 0;
  const items = readOutbox();
  if (items.length === 0) return 0;

  const remaining: OutboxItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (okCount >= maxPerFlush) {
      remaining.push(it);
      continue;
    }
    try {
      if (it.type === "start_conversation") {
        if (!it.participantId) throw new Error("missing participantId");
        // 1) iniciar/recuperar conversación
        const startRes = await fetchWithTimeout("/api/chat/conversations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: it.participantId }),
          timeoutMs: 10000,
        });
        if (!startRes.ok) throw new Error("start conversation failed");
        const startData = await startRes.json();
        const conversationId = String(startData?.conversation_id || "");
        if (!conversationId) throw new Error("no conversationId");
        // 2) enviar mensaje
        const msgRes = await fetchWithTimeout(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: it.body }),
          timeoutMs: 10000,
        });
        if (!msgRes.ok) throw new Error("send message failed");
        okCount += 1;
      } else if (it.type === "conversation_message") {
        if (!it.conversationId) throw new Error("missing conversationId");
        const msgRes = await fetchWithTimeout(`/api/chat/conversations/${encodeURIComponent(it.conversationId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: it.body }),
          timeoutMs: 10000,
        });
        if (!msgRes.ok) throw new Error("send message failed");
        okCount += 1;
      } else {
        throw new Error("unknown outbox type");
      }
    } catch (e) {
      // Mantener el ítem para reintento futuro
      remaining.push(it);
    }
  }

  writeOutbox(remaining);
  return okCount;
}

export function setupOutboxAutoFlush(): () => void {
  if (typeof window === "undefined") return () => {};
  const onOnline = async () => {
    try { await flushOutbox(10); } catch {}
  };
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}
