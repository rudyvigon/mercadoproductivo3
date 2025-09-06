import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPusher } from "@/lib/pusher/server";
import { trySendWebPush } from "@/lib/push/server";
import { getSenderDisplayName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function normalizeAvatarUrl(raw: string | null | undefined, supabase: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Ya pública
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes("/storage/v1/object/public/avatars/") || s.includes("/object/public/avatars/")) return s;
  // Tratar como path dentro del bucket
  const path = s.replace(/^avatars\//, "");
  try {
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  if (process.env.FEATURE_CHAT_V2_ENABLED !== "true") {
    return NextResponse.json(
      { error: "CHAT_DESHABILITADO", message: "El sistema de chat v2 está temporalmente deshabilitado." },
      { status: 410 }
    );
  }
  try {
    const conversationId = String(ctx.params.id || "");
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    // Verificar membresía
    const { data: mem, error: memErr } = await supabase
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr) return NextResponse.json({ error: "MEMBERSHIP_CHECK_FAILED" }, { status: 500 });
    if (!mem) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "50", 10)));
    const afterParam = url.searchParams.get("after");
    const beforeParam = url.searchParams.get("before");
    const orderParam = String(url.searchParams.get("order") || "asc").toLowerCase();
    const ascending = orderParam !== "desc";

    let query = supabase
      .from("chat_messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", conversationId);

    // Ventana temporal: preferir 'before' para paginar hacia atrás; si no, aplicar 'after' para incremental
    if (beforeParam) {
      const d = new Date(beforeParam);
      if (!Number.isNaN(d.getTime())) {
        query = query.lt("created_at", d.toISOString());
      }
    } else if (afterParam) {
      const d = new Date(afterParam);
      if (!Number.isNaN(d.getTime())) {
        query = query.gt("created_at", d.toISOString());
      }
    }

    // Orden estable por fecha y desempate por id
    query = query.order("created_at", { ascending }).order("id", { ascending }).limit(limit);

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: "LOAD_FAILED", message: error.message }, { status: 500 });

    // Enriquecer con datos de perfil (nombre, email, avatar)
    const senderIds = Array.from(new Set((rows || []).map((r: any) => r.sender_id).filter(Boolean)));
    let profMap: Record<string, { id: string; company?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null; avatar_url?: string | null }> = {};
    if (senderIds.length > 0) {
      try {
        const admin = createAdminClient();
        const { data: profs } = await admin
          .from("profiles")
          .select("id,company,full_name,first_name,last_name,avatar_url")
          .in("id", senderIds);
        profMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
        // Obtener emails desde Auth admin
        const emailMap: Record<string, string | null> = {};
        for (const uid of senderIds) {
          try {
            const { data: u } = await (admin as any).auth.admin.getUserById(uid);
            emailMap[uid] = (u?.user?.email || null) as any;
          } catch {
            emailMap[uid] = null;
          }
        }
        // Adjuntar email en profMap virtualmente
        for (const uid of senderIds) {
          const base = profMap[uid] || { id: uid } as any;
          (base as any).email = emailMap[uid] ?? null;
          profMap[uid] = base as any;
        }
      } catch {}
    }

    const enriched = (rows || []).map((m: any) => {
      const p = (profMap[m.sender_id] || {}) as any;
      const emailLocal = p.email ? String(p.email).split("@")[0] : undefined;
      const sender_name = getSenderDisplayName(
        {
          company: p.company ?? null,
          full_name: p.full_name ?? null,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
        },
        emailLocal
      );
      const sender_email = (p as any).email || null;
      const avatar_url = normalizeAvatarUrl(p.avatar_url, supabase);
      return { ...m, sender_name, sender_email, avatar_url };
    });

    return NextResponse.json({ messages: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  if (process.env.FEATURE_CHAT_V2_ENABLED !== "true") {
    return NextResponse.json(
      { error: "CHAT_DESHABILITADO", message: "El sistema de chat v2 está temporalmente deshabilitado." },
      { status: 410 }
    );
  }
  try {
    const conversationId = String(ctx.params.id || "");
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const json = await req.json().catch(() => ({}));
    const body = String(json?.body || "").trim();
    if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });

    // Verificar membresía
    const { data: mem, error: memErr } = await supabase
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr) return NextResponse.json({ error: "MEMBERSHIP_CHECK_FAILED" }, { status: 500 });
    if (!mem) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    // Insert con RLS (usa auth del usuario)
    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body })
      .select("id,conversation_id,sender_id,body,created_at")
      .single();
    if (error) return NextResponse.json({ error: "INSERT_FAILED", message: error.message }, { status: 500 });

    // Emitir eventos en Pusher y (opcionalmente) Web Push
    try {
      const admin = createAdminClient();
      const { data: members } = await admin
        .from("chat_conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);
      const memberIds = (members || []).map((m: any) => m.user_id).filter(Boolean);
      // Perfil del remitente para enriquecer el payload
      let senderProfile: any = null;
      try {
        const { data: prof } = await admin
          .from("profiles")
          .select("id,company,full_name,first_name,last_name,avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        senderProfile = prof || null;
      } catch {}
      // Email desde Auth admin
      let senderEmail: string | null = null;
      try {
        const { data: u } = await (admin as any).auth.admin.getUserById(user.id);
        senderEmail = (u?.user?.email || null) as any;
      } catch {}
      const enrichedInserted = {
        ...inserted,
        sender_name: getSenderDisplayName(
          {
            company: senderProfile?.company ?? null,
            full_name: senderProfile?.full_name ?? null,
            first_name: senderProfile?.first_name ?? null,
            last_name: senderProfile?.last_name ?? null,
          },
          senderEmail ? String(senderEmail).split("@")[0] : undefined
        ),
        sender_email: senderEmail,
        avatar_url: normalizeAvatarUrl(senderProfile?.avatar_url, supabase),
      } as any;
      const p = getPusher();
      const tasks: Promise<any>[] = [];
      // Evento de mensaje nuevo en canal de conversación (ambos participantes suscritos a este canal lo recibirán)
      tasks.push(
        p.trigger(`private-conversation-${conversationId}`, "chat:message:new", enrichedInserted as any)
      );
      // Refrescar bandeja solo de los otros miembros (evitar notificar al emisor)
      for (const uid of memberIds) {
        if (String(uid) === String(user.id)) continue;
        tasks.push(
          p.trigger(`private-user-${uid}`, "chat:conversation:updated", { conversation_id: conversationId })
        );
      }
      // Intentar Web Push hacia los otros miembros (si hay suscripciones y claves VAPID configuradas)
      try {
        const targetIds = memberIds.filter((uid: string) => String(uid) !== String(user.id));
        if (targetIds.length > 0) {
          const { data: subs } = await admin
            .from("push_subscriptions")
            .select("endpoint,p256dh,auth,user_id")
            .in("user_id", targetIds);
          const payload = {
            title: "Nuevo mensaje",
            body,
            url: "/dashboard/messages",
            icon: "/favicon.ico",
          };
          const sendTasks = (subs || []).map((s: any) => trySendWebPush(s.endpoint, { p256dh: s.p256dh || undefined, auth: s.auth || undefined }, payload));
          if (sendTasks.length > 0) {
            // No bloquear respuesta por Web Push; fire-and-forget
            Promise.allSettled(sendTasks).catch(() => {});
          }
        }
      } catch {}
      await Promise.all(tasks);
    } catch (e) {
      // swallow
    }

    return NextResponse.json({ message: {
      ...inserted,
      sender_name: undefined, // por compatibilidad, el cliente ya usa enrichedInserted del realtime; opcionalmente podríamos devolver enrichedInserted aquí también
      sender_email: undefined,
      avatar_url: undefined,
    } });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
