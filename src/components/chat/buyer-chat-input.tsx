"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { enqueueStartConversation, enqueueConversationMessage } from "@/lib/chat/offline-queue";

export type BuyerInputSent = {
  kind: "message" | "reply";
  id: string;
  message_id: string; // thread id
  body: string;
  created_at: string;
};

export default function BuyerChatInput({
  sellerId,
  threadId,
  onSent,
}: {
  sellerId: string;
  threadId: string | null;
  onSent: (evt: BuyerInputSent) => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitAtRef = useRef<number>(0);

  function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
    const { timeoutMs = 10000, ...rest } = opts;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(t));
  }

  const emitTyping = useCallback(async (typing: boolean, immediate = false) => {
    try {
      if (!threadId) return;
      const now = Date.now();
      if (!immediate && typing && now - (lastTypingEmitAtRef.current || 0) < 1200) return;
      lastTypingEmitAtRef.current = now;
      await fetchWithTimeout(`/api/chat/conversations/${encodeURIComponent(threadId)}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: Boolean(typing) }),
        timeoutMs: 6000,
      });
    } catch {}
  }, [threadId]);

  async function send() {
    const body = value.trim();
    // Regla actual: permitir desde 1 carácter, tanto para nuevo hilo como para respuesta
    if (body.length < 1) {
      toast.error("El mensaje debe tener al menos 1 carácter.");
      return;
    }
    setLoading(true);
    try {
      if (!threadId) {
        // Chat v2: iniciar (o recuperar) conversación y enviar primer mensaje
        const startRes = await fetchWithTimeout("/api/chat/conversations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: sellerId }),
          timeoutMs: 10000,
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData?.message || startData?.error || "No se pudo iniciar la conversación");
        const conversationId = String(startData?.conversation_id || "");
        if (!conversationId) throw new Error("No se pudo obtener la conversación");

        const msgRes = await fetchWithTimeout(`/api/chat/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
          timeoutMs: 10000,
        });
        const msgData = await msgRes.json();
        if (!msgRes.ok) throw new Error(msgData?.message || msgData?.error || "No se pudo enviar");
        const id = String(msgData?.message?.id || msgData?.id);
        const created_at = String(msgData?.message?.created_at || msgData?.created_at || new Date().toISOString());
        onSent({ kind: "message", id, message_id: conversationId, body, created_at });
        setValue("");
      } else {
        // Chat v2: enviar mensaje en conversación existente (threadId es conversationId)
        const msgRes = await fetchWithTimeout(`/api/chat/conversations/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
          timeoutMs: 10000,
        });
        const msgData = await msgRes.json();
        if (!msgRes.ok) throw new Error(msgData?.message || msgData?.error || "No se pudo enviar");
        const id = String(msgData?.message?.id || msgData?.id);
        const created_at = String(msgData?.message?.created_at || msgData?.created_at || new Date().toISOString());
        onSent({ kind: "message", id, message_id: threadId, body, created_at });
        setValue("");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al enviar");
      try {
        const offline = typeof navigator !== "undefined" && navigator && (navigator as any).onLine === false;
        if (offline) {
          if (!threadId) {
            enqueueStartConversation(sellerId, body);
          } else {
            enqueueConversationMessage(threadId, body);
          }
          toast.info("Mensaje en cola offline: se enviará automáticamente al reconectar.");
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
      e.preventDefault();
      if (!loading) send();
    }
  }

  const onChangeValue = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Señalizar escribiendo (si ya existe thread)
    void emitTyping(true);
    try { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); } catch {}
    typingTimerRef.current = setTimeout(() => { void emitTyping(false, true); }, 3500);
  };

  useEffect(() => {
    return () => {
      try { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); } catch {}
      try { void emitTyping(false, true); } catch {}
    };
  }, [emitTyping]);

  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={value}
        onChange={onChangeValue}
        onKeyDown={onKeyDown}
        rows={2}
        placeholder={threadId ? "Escribe un mensaje..." : "Escribe para iniciar la conversación"}
        disabled={loading}
      />
      <Button onClick={send} disabled={loading || value.trim().length < 1}>
        {loading ? "Enviando..." : "Enviar"}
      </Button>
    </div>
  );
}
