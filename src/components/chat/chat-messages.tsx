"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeAvatarUrl, initialFrom, avatarAltIncoming, avatarAltOutgoing } from "@/lib/user-display";

export type ChatItem = {
  id: string;
  type: "incoming" | "outgoing";
  message_id?: string;
  body: string;
  created_at: string;
  sender_name?: string;
  sender_email?: string;
  delivery_status?: "sent" | "delivered" | "read";
  avatar_url?: string;
};

export default function ChatMessages({ items }: { items: ChatItem[] }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      bottomRef.current?.scrollIntoView({ block: "end", inline: "nearest" });
    } catch {}
  }, [items]);
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, idx) => {
        const currDate = new Date(it.created_at);
        const currKey = `${currDate.getFullYear()}-${currDate.getMonth()}-${currDate.getDate()}`;
        const prev = items[idx - 1];
        const showDateDivider = (() => {
          if (!prev) return true;
          try {
            const d = new Date(prev.created_at);
            const prevKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            return prevKey !== currKey;
          } catch {
            return false;
          }
        })();
        const initial = initialFrom(it.sender_name, it.sender_email);
        return (
          <div key={it.id} className="flex w-full flex-col">
            {showDateDivider && (
              <div className="my-3 text-center">
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                  {currDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              </div>
            )}
            <div className={cn("flex w-full items-end gap-2", it.type === "incoming" ? "justify-start" : "justify-end")}>
              {it.type === "incoming" && (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={normalizeAvatarUrl(it.avatar_url)} alt={avatarAltIncoming(it.sender_name, it.sender_email)} />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  it.type === "incoming"
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground"
                )}
                title={new Date(it.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
              >
                {it.sender_name && (
                  <div className={cn("mb-0.5 text-[10px] font-medium opacity-80", it.type === "incoming" ? "text-foreground" : "text-primary-foreground")}>{it.sender_name}</div>
                )}
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
                </div>
              </div>
              {it.type === "outgoing" && (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={normalizeAvatarUrl(it.avatar_url)} alt={avatarAltOutgoing(it.sender_name, it.sender_email)} />
                  <AvatarFallback>{initialFrom(it.sender_name, it.sender_email)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}



