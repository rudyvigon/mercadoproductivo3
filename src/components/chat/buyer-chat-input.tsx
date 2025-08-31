"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
        const startRes = await fetch("/api/chat/conversations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: sellerId }),
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData?.message || startData?.error || "No se pudo iniciar la conversación");
        const conversationId = String(startData?.conversation_id || "");
        if (!conversationId) throw new Error("No se pudo obtener la conversación");

        const msgRes = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const msgData = await msgRes.json();
        if (!msgRes.ok) throw new Error(msgData?.message || msgData?.error || "No se pudo enviar");
        const id = String(msgData?.message?.id || msgData?.id);
        const created_at = String(msgData?.message?.created_at || msgData?.created_at || new Date().toISOString());
        onSent({ kind: "message", id, message_id: conversationId, body, created_at });
        setValue("");
      } else {
        // Chat v2: enviar mensaje en conversación existente (threadId es conversationId)
        const msgRes = await fetch(`/api/chat/conversations/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
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

  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
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

