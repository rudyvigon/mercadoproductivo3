"use client";
import Pusher, { Channel } from "pusher-js";

let client: Pusher | null = null;

function isChatV2Enabled(): boolean {
  const val = String(process.env.NEXT_PUBLIC_FEATURE_CHAT_V2_ENABLED || "");
  return ["1", "true", "on", "yes"].includes(val.toLowerCase());
}

export function getPusherClient(): Pusher | null {
  if (client) return client;
  // Gateo por feature flag: si Chat V2 está deshabilitado, no inicializamos Pusher
  if (!isChatV2Enabled()) {
    return null;
  }
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY as string | undefined;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string | undefined;
  if (!key || !cluster) {
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
  return client;
}

export function subscribePrivate(channelName: string): Channel | null {
  const p = getPusherClient();
  if (!p) return null;
  const ch = p.subscribe(channelName);
  return ch;
}

