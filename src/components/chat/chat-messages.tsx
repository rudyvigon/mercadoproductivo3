"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ChatItem = {
  id: string;
  type: "incoming" | "outgoing";
  message_id?: string;
  body: string;
  created_at: string;
  sender_name?: string;
  sender_email?: string;
  delivery_status?: "sent" | "delivered" | "read";
  deleted?: boolean;
};

export default function ChatMessages({
  items,
  onDeleted,
}: {
  items: ChatItem[];
  onDeleted?: (id: string, kind: "msg" | "rep", messageId?: string) => void;
}) {
  async function handleDelete(it: ChatItem) {
    try {
      const isMsg = it.id.startsWith("msg-");
      const rawId = isMsg ? it.id.slice(4) : it.id.slice(4);
      if (!rawId) return;
      const ok = typeof window !== "undefined" ? window.confirm("¿Eliminar este mensaje?") : true;
      if (!ok) return;
      const url = isMsg ? `/api/messages/${rawId}` : `/api/replies/${rawId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP_${res.status}`);
      }
      onDeleted?.(rawId, isMsg ? "msg" : "rep", it.message_id || rawId);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <div key={it.id} className={cn("flex w-full", it.type === "incoming" ? "justify-start" : "justify-end")}
        >
          <div
            className={cn(
              "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
              it.type === "incoming"
                ? "bg-muted text-foreground"
                : "bg-primary text-primary-foreground"
            )}
            title={new Date(it.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
          >
            <div className={cn("whitespace-pre-wrap break-words", it.deleted ? "italic opacity-70" : "")}>{it.deleted ? "Mensaje eliminado" : it.body}</div>
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-[10px] opacity-70",
                it.type === "incoming" ? "text-foreground" : "text-primary-foreground"
              )}
            >
              {it.type === "outgoing" && !it.deleted && (
                <button
                  type="button"
                  onClick={() => handleDelete(it)}
                  className={cn("mr-2 underline decoration-dotted hover:opacity-100 opacity-90")}
                  title="Eliminar"
                  aria-label="Eliminar"
                >
                  Eliminar
                </button>
              )}
              <span>
                {new Date(it.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {it.type === "outgoing" && !it.deleted && (
                <span
                  className={cn(
                    "ml-1",
                    it.delivery_status === "read" ? "text-sky-200" : ""
                  )}
                  aria-label={it.delivery_status || "sent"}
                  title={it.delivery_status || "sent"}
                >
                  {it.delivery_status === "read"
                    ? "✓✓"
                    : it.delivery_status === "delivered"
                    ? "✓✓"
                    : "✓"}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

