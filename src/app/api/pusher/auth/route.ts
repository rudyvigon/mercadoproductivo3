import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getPusher } from "@/lib/pusher/server";
import { emailSlug } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
const isDev = process.env.NODE_ENV !== "production";

function forbidden(reason: string, extra?: Record<string, any>) {
  try {
    // Log solo en servidor para diagnóstico
    console.warn("[/api/pusher/auth] FORBIDDEN", { reason, ...(extra || {}) });
  } catch {}
  const payload = isDev ? { error: "FORBIDDEN", reason, ...(extra || {}) } : { error: "FORBIDDEN" };
  return NextResponse.json(payload, { status: 403 });
}

export async function POST(req: Request) {
  try {
    // Pusher envía application/x-www-form-urlencoded
    const form = await req.formData();
    const socketId = String(form.get("socket_id") || "").trim();
    const channelName = String(form.get("channel_name") || "").trim();

    if (!socketId || !channelName) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

    const supabase = createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return forbidden("NO_USER", { socketId, channelName });

    // Autorizamos solo canales privados del vendedor autenticado: private-seller-{sellerId}
    if (channelName.startsWith("private-seller-")) {
      const parts = channelName.split("-");
      const sellerId = parts.slice(2).join("-");
      if (!sellerId || sellerId !== user.id) return forbidden("SELLER_ID_MISMATCH", { socketId, channelName, userId: user.id });
    } else if (channelName.startsWith("private-thread-")) {
      // Canal de hilo comprador: private-thread-{sellerId}-{emailSlug}
      // Validar por sufijo para evitar ambigüedad con guiones en sellerId o slug
      const expected = emailSlug(user.email || "");
      if (!expected) return forbidden("THREAD_SLUG_EMPTY", { socketId, channelName, userId: user.id });
      const prefix = "private-thread-";
      const suffix = `-${expected}`;
      if (!channelName.startsWith(prefix)) return forbidden("THREAD_MALFORMED", { socketId, channelName, userId: user.id });
      if (!channelName.endsWith(suffix)) {
        const got = channelName.slice(channelName.lastIndexOf("-") + 1);
        return forbidden("THREAD_SLUG_MISMATCH", { socketId, channelName, userId: user.id, expected, got });
      }
      const sellerId = channelName.slice(prefix.length, channelName.length - suffix.length);
      if (!sellerId) return forbidden("THREAD_NO_SELLER", { socketId, channelName, userId: user.id });
    } else {
      // Bloquear otros patrones
      return forbidden("UNKNOWN_CHANNEL", { socketId, channelName, userId: user.id });
    }

    const pusher = getPusher();
    const auth = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (e: any) {
    console.error("[/api/pusher/auth] error", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

