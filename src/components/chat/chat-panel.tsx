"use client";
import React from "react";
// DEPRECADO: Este componente fue reemplazado por `ChatWindow` y `BuyerChatWindow`.
// Mantener este archivo solo para detectar usos accidentales durante la migración.
// Si necesitas una conversación, importa desde:
// - "@/components/chat/chat-window"
// - "@/components/chat/buyer-chat-window"

export default function ChatPanel({
  open,
  onOpenChange,
  sellerId,
  contactEmail,
  contactName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sellerId: string;
  contactEmail: string;
  contactName?: string | null;
}) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[DEPRECATION] ChatPanel está deprecado. Usa ChatWindow o BuyerChatWindow.");
  }
  throw new Error("ChatPanel deprecado: usa ChatWindow o BuyerChatWindow.");
}
