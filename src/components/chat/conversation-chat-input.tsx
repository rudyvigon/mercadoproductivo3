"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

export type ChatV2Sent = {
  id: string;
  message_id: string; // conversation id
  body: string;
  created_at: string;
};

export default function ConversationChatInput({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent: (evt: ChatV2Sent) => void;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (sending || !value.trim()) return;
    setSending(true);

    // Optimistically update the UI
    const tempId = `temp-${Date.now()}`;
    const sentAt = new Date().toISOString();
    onSent?.({
      id: tempId,
      message_id: conversationId,
      body: value.trim(),
      created_at: sentAt,
    });

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: value.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Error al enviar");

      setValue("");
      // No disparamos onSent nuevamente: el reemplazo vendrá por realtime (chat:message:new)
    } catch (e: any) {
      console.error("Error sending message:", e);
      // Optionally, you could trigger a refresh to get the correct state
      // onRefresh?.();
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.key === "Enter" || (e as any).keyCode === 13) && !e.shiftKey) {
      e.preventDefault();
      if (!sending) handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-1 items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Escribe un mensaje..."
          disabled={sending}
          className="flex-1 resize-none"
        />
      </div>
      <Button onClick={handleSend} disabled={sending || value.trim().length < 1}>
        {sending ? (
          "Enviando..."
        ) : (
          <span className="inline-flex items-center gap-1">
            <Send className="h-4 w-4" />
            Enviar
          </span>
        )}
      </Button>
    </div>
  );
}
