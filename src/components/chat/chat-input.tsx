"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type ReplyPayload = {
  id: string;
  created_at: string;
  message_id: string;
  body: string;
  sender_id: string;
};

export default function ChatInput({
  messageId,
  sellerId,
  contactEmail,
  onSent,
}: {
  messageId: string | null;
  sellerId?: string | null;
  contactEmail?: string | null;
  onSent: (payload: ReplyPayload) => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const body = value.trim();
    // Modo creación: no hay thread aún. Enviamos al endpoint de creación.
    if (!messageId) {
      if (!sellerId) {
        toast.error("Falta identificar al vendedor.");
        return;
      }
      if (body.length < 1) {
        toast.error("Tu mensaje debe tener al menos 1 carácter.");
        return;
      }
      setLoading(true);
      try {
        if (contactEmail) {
          // Inicio por parte del vendedor hacia un comprador específico
          const res = await fetch(`/api/messages/start-by-seller`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactEmail, body }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo enviar");
          if (data?.id && data?.reply_id) {
            const payload: ReplyPayload = {
              id: String(data.reply_id),
              created_at: new Date().toISOString(),
              message_id: String(data.id),
              body,
              sender_id: "self",
            };
            onSent(payload);
            setValue("");
          }
        } else {
          // Inicio por parte del comprador (o cualquier usuario) hacia el vendedor
          const res = await fetch(`/api/messages/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sellerId, body }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo enviar");
          if (data?.id) {
            // Consideramos el id del mensaje inicial como message_id para futuras respuestas.
            const payload: ReplyPayload = {
              id: String(data.id),
              created_at: new Date().toISOString(),
              message_id: String(data.id),
              body,
              sender_id: "self",
            };
            onSent(payload);
            setValue("");
          }
        }
      } catch (e: any) {
        toast.error(e?.message || "Error al enviar");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Modo respuesta: existe un messageId base.
    if (body.length < 1) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/${messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo enviar");
      if (data?.reply_id) {
        // El endpoint devuelve ok + reply_id, pero además emitimos reply:new con todo el payload.
        // No dependemos del realtime para actualizar la UI inmediatamente.
        const payload: ReplyPayload = {
          id: String(data.reply_id),
          created_at: new Date().toISOString(),
          message_id: messageId,
          body,
          sender_id: "self",
        };
        onSent(payload);
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
        placeholder={messageId ? "Escribe un mensaje..." : "Escribe para iniciar la conversación"}
        disabled={loading || (!messageId && !sellerId)}
      />
      <Button
        onClick={send}
        disabled={
          loading || (!messageId ? (!sellerId || value.trim().length < 1) : value.trim().length < 1)
        }
      >
        {loading ? "Enviando..." : "Enviar"}
      </Button>
    </div>
  );
}
