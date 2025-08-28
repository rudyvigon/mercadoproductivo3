"use client";
import React from "react";
import { cn } from "@/lib/utils";

export type ChatItem = {
  id: string;
  type: "incoming" | "outgoing";
  message_id?: string;
  body: string;
  created_at: string;
  sender_name?: string;
  sender_email?: string;
  delivery_status?: "sent" | "delivered" | "read";
};

export default function ChatMessages({ items }: { items: ChatItem[] }) {
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
            <div className="whitespace-pre-wrap break-words">{it.body}</div>
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-[10px] opacity-70",
                it.type === "incoming" ? "text-foreground" : "text-primary-foreground"
              )}
            >
              <span>
                {new Date(it.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {it.type === "outgoing" && (
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

