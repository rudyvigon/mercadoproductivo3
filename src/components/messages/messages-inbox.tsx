"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPusherClient, subscribePrivate } from "@/lib/pusher/client";
import { useMessagesNotifications } from "@/store/messages-notifications";
import ChatWindow from "@/components/chat/chat-window";

type Message = {
  id: string;
  created_at: string;
  updated_at: string;
  seller_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string;
  body: string;
  status: "new" | "read" | "replied" | "archived" | "spam" | "blocked";
};

type Conversation = {
  sender_email: string;
  sender_name?: string;
  last_created_at: string;
  last_subject?: string;
  unread_count: number;
  total_count: number;
};

const STATUS_OPTIONS: { value: "all" | Message["status"]; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevos" },
  { value: "read", label: "Leídos" },
  { value: "replied", label: "Respondidos" },
];

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: Message["status"] }) {
  const color =
    status === "new"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : status === "read"
      ? "bg-blue-100 text-blue-900 border-blue-200"
      : status === "replied"
      ? "bg-indigo-100 text-indigo-900 border-indigo-200"
      : status === "archived"
      ? "bg-zinc-100 text-zinc-900 border-zinc-200"
      : status === "spam"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-rose-100 text-rose-900 border-rose-200"; // blocked
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", color)}>{label}</span>;
}

export default function MessagesInbox({ sellerId }: { sellerId: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Message["status"]>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatEmail, setChatEmail] = useState<string | null>(null);
  const [chatName, setChatName] = useState<string | null>(null);

  const { bumpUnread } = useMessagesNotifications();

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (status && status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Error al cargar mensajes");
      setItems(data.items || []);
      // Agrupar por remitente (conversaciones)
      const map = new Map<string, Conversation>();
      (data.items || []).forEach((m: Message) => {
        const prev = map.get(m.sender_email);
        if (!prev) {
          map.set(m.sender_email, {
            sender_email: m.sender_email,
            sender_name: m.sender_name,
            last_created_at: m.created_at,
            last_subject: m.subject,
            unread_count: m.status === "new" ? 1 : 0,
            total_count: 1,
          });
        } else {
          prev.total_count += 1;
          if (m.status === "new") prev.unread_count += 1;
          // mantener el último por fecha
          if (new Date(m.created_at).getTime() > new Date(prev.last_created_at).getTime()) {
            prev.last_created_at = m.created_at;
            prev.last_subject = m.subject;
            prev.sender_name = m.sender_name || prev.sender_name;
          }
        }
      });
      const groups = Array.from(map.values()).sort((a, b) => new Date(b.last_created_at).getTime() - new Date(a.last_created_at).getTime());
      setConversations(groups);
      setTotal(groups.length);
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar los mensajes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200); // pequeño debounce al escribir
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, page, pageSize]);

  async function updateStatus(
    id: string,
    newStatus: Message["status"],
    opts?: { optimistic?: boolean }
  ) {
    const prevStatus = items.find((m) => m.id === id)?.status;
    if (opts?.optimistic) {
      // Actualización optimista en UI y store de notificaciones
      if (prevStatus === "new" && newStatus !== "new") bumpUnread(-1);
      if (prevStatus !== "new" && newStatus === "new") bumpUnread(1);
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)));
    }
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "No se pudo actualizar el estado");
      // Sincronizar UI por si no era optimista
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)));
      toast.success("Estado actualizado");
    } catch (e: any) {
      // Revertir optimismo si falló
      if (opts?.optimistic && prevStatus) {
        if (prevStatus === "new" && newStatus !== "new") bumpUnread(1);
        if (prevStatus !== "new" && newStatus === "new") bumpUnread(-1);
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status: prevStatus } : m)));
      }
      toast.error(e?.message || "No se pudo actualizar el estado");
    }
  }

  function openMessage(m: { sender_email: string; sender_name?: string }) {
    // Marcar leído al abrir si era nuevo (optimista)
    // Nota: al nivel de conversación no sabemos cuál id actualizar; se manejará desde el chat al recibir reply/new.
    setChatEmail(m.sender_email);
    setChatName(m.sender_name || null);
    setChatOpen(true);
  }

  // Suscripción a Pusher para actualizaciones en tiempo real
  useEffect(() => {
    const client = getPusherClient();
    if (!client || !sellerId) return;
    const channelName = `private-seller-${sellerId}`;
    const ch = subscribePrivate(channelName);
    if (!ch) return;

    const onNew = () => { load(); };
    const onUpdated = () => { load(); };

    ch.bind("message:new", onNew);
    ch.bind("message:updated", onUpdated);

    return () => {
      ch.unbind("message:new", onNew);
      ch.unbind("message:updated", onUpdated);
      getPusherClient()?.unsubscribe(channelName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, page]);

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
            placeholder="Buscar por asunto, mensaje o remitente..."
            className="max-w-md"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(1);
              setStatus(v as any);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value as any}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v, 10))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / página
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-3 sm:col-span-2">Última fecha</div>
          <div className="col-span-6 sm:col-span-7">Conversación</div>
          <div className="col-span-3 sm:col-span-3 text-right">No leídos</div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div>
            {conversations.length === 0 && (
              <div className="px-3 py-6 text-sm text-muted-foreground">No hay mensajes.</div>
            )}
            {conversations.map((c) => (
              <div key={c.sender_email} className="border-b">
                <button
                  className={cn(
                    "grid w-full grid-cols-12 items-center gap-2 px-3 py-2 text-left hover:bg-muted/40",
                    c.unread_count > 0 && "bg-emerald-50"
                  )}
                  onClick={() => openMessage({ sender_email: c.sender_email, sender_name: c.sender_name })}
                >
                  <div className="col-span-3 sm:col-span-2 text-xs sm:text-sm">{fmtDate(c.last_created_at)}</div>
                  <div className="col-span-6 sm:col-span-7 text-xs sm:text-sm">
                    <div className="font-medium">{c.sender_name || c.sender_email}</div>
                    <div className="text-muted-foreground truncate">{c.last_subject || "—"}</div>
                  </div>
                  <div className="col-span-3 sm:col-span-3 flex items-center justify-end">
                    {c.unread_count > 0 ? (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {c.unread_count}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Ventana de chat estilo Messenger */}
      {chatEmail ? (
        <ChatWindow
          open={chatOpen}
          onOpenChange={setChatOpen}
          sellerId={sellerId}
          contactEmail={chatEmail}
          contactName={chatName || undefined}
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
