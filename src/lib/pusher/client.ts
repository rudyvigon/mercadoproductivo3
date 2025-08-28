"use client";
import Pusher, { Channel } from "pusher-js";

let client: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY as string | undefined;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string | undefined;
  if (!key || !cluster) {
    console.error("[PUSHER] Faltan NEXT_PUBLIC_PUSHER_KEY o NEXT_PUBLIC_PUSHER_CLUSTER");
    return null;
  }
  client = new Pusher(key, {
    cluster,
    forceTLS: true,
    // Autorización de canales privados (v8)
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });
  // Logs de diagnóstico de conexión
  try {
    const conn = client.connection as any;
    conn.bind("state_change", (states: any) => {
      console.debug("[PUSHER] state_change", states);
    });
    conn.bind("error", (err: any) => {
      console.warn("[PUSHER] connection error", err);
    });
  } catch {}
  return client;
}

export function subscribePrivate(channelName: string): Channel | null {
  const p = getPusherClient();
  if (!p) return null;
  const ch = p.subscribe(channelName);
  try {
    ch.bind("pusher:subscription_succeeded", () => {
      console.debug("[PUSHER] suscripción OK", { channelName });
    });
    ch.bind("pusher:subscription_error", (status: any) => {
      // status puede ser number o un objeto con más datos según pusher-js
      console.error("[PUSHER] suscripción FALLÓ", { channelName, status });
    });
  } catch {}
  return ch;
}
