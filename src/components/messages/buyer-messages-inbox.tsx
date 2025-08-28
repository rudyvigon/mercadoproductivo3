"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import BuyerConversationWindow from "@/components/chat/buyer-conversation-window";
import { createClient } from "@/lib/supabase/client";
import { getPusherClient, subscribePrivate } from "@/lib/pusher/client";
import { emailSlug } from "@/lib/email";

export type BuyerConversation = {
  seller_id: string;
  seller_company: string | null;
  seller_avatar_url: string | null;
  plan_code: string | null;
  plan_label: string | null;
  total_messages: number;
  last_message_at: string | null;
  last_reply_at: string | null;
  last_activity_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function BuyerMessagesInbox() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BuyerConversation[]>([]);
  const [total, setTotal] = useState(0);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatSellerId, setChatSellerId] = useState<string | null>(null);
  const [chatSellerName, setChatSellerName] = useState<string | null>(null);
  const [chatSellerAvatar, setChatSellerAvatar] = useState<string | null>(null);

  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Cargar email usuario
  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setCurrentEmail(data.user?.email ?? null);
      } catch {}
    }
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/messages/buyer?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Error al cargar");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar las conversaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, pageSize]);

  // Suscripciones Pusher por cada sellerId
  useEffect(() => {
    const client = getPusherClient();
    if (!client || !currentEmail) return;
    const subs: { name: string; unbind: () => void }[] = [];

    items.forEach((c) => {
      const channelName = `private-thread-${c.seller_id}-${emailSlug(currentEmail)}`;
      const ch = subscribePrivate(channelName);
      if (!ch) return;

      const onAny = () => {
        // Actualizar lista ante nuevo mensaje o reply
        load();
      };
      ch.bind("message:new", onAny);
      ch.bind("reply:new", onAny);

      subs.push({
        name: channelName,
        unbind: () => {
          ch.unbind("message:new", onAny);
          ch.unbind("reply:new", onAny);
          getPusherClient()?.unsubscribe(channelName);
        },
      });
    });

    return () => {
      subs.forEach((s) => s.unbind());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, currentEmail]);

  function openChat(c: BuyerConversation) {
    setChatSellerId(c.seller_id);
    setChatSellerName(c.seller_company || "Vendedor");
    setChatSellerAvatar(c.seller_avatar_url || null);
    setChatOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Buscar vendedor..."
            className="max-w-md"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-6 sm:col-span-7">Vendedor</div>
          <div className="col-span-6 sm:col-span-5 text-right">Última actividad</div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div>
            {items.length === 0 && <div className="px-3 py-6 text-sm text-muted-foreground">No hay conversaciones.</div>}
            {items.map((c) => (
              <div key={c.seller_id} className="border-b">
                <button
                  className={cn("grid w-full grid-cols-12 items-center gap-2 px-3 py-2 text-left hover:bg-muted/40")}
                  onClick={() => openChat(c)}
                >
                  <div className="col-span-6 sm:col-span-7 flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.seller_avatar_url || undefined} alt={c.seller_company || "Vendedor"} />
                      <AvatarFallback>{(c.seller_company?.[0] || "V").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.seller_company || "Vendedor"}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.plan_label || c.plan_code || ""}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-6 sm:col-span-5 text-right text-xs sm:text-sm">{fmtDate(c.last_activity_at)}</div>
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {currentEmail && chatSellerId ? (
        <BuyerConversationWindow
          open={chatOpen}
          onOpenChange={setChatOpen}
          sellerId={chatSellerId}
          sellerName={chatSellerName || undefined}
          sellerAvatarUrl={chatSellerAvatar || undefined}
          currentUserEmail={currentEmail}
        />
      ) : null}

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {total} conversación(es) • Página {page} de {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
