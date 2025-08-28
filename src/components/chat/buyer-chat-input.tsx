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
        // Enviar nuevo mensaje (crea hilo)
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerId, body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo enviar");
        const id = String(data?.id);
        onSent({ kind: "message", id, message_id: id, body, created_at: new Date().toISOString() });
        setValue("");
      } else {
        // Responder en hilo existente
        const res = await fetch(`/api/messages/${threadId}/reply/buyer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo enviar");
        const id = String(data?.reply_id);
        onSent({ kind: "reply", id, message_id: threadId, body, created_at: new Date().toISOString() });
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
