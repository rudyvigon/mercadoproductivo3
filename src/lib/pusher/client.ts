"use client";
import Pusher, { Channel } from "pusher-js";

type PusherConnectionState = 'initialized' | 'connecting' | 'connected' | 'unavailable' | 'failed' | 'disconnected';
type ConnectionStateHandler = (state: PusherConnectionState) => void;
type ErrorHandler = (error: { type: string; error: any }) => void;

let client: Pusher | null = null;
let featureChecked = false;
let featureEnabled = false;
let connectionState: PusherConnectionState = 'disconnected';
const stateHandlers: Set<ConnectionStateHandler> = new Set();
const errorHandlers: Set<ErrorHandler> = new Set();
// Registro de canales suscritos (telemetría/limpieza)
const channelRegistry: Set<string> = new Set();
const channelOrder: string[] = [];
const MAX_CHANNELS_SOFT = 20; // Solo advertencia si se supera

async function ensureFeatureFlagLoaded(): Promise<void> {
  if (featureChecked) return;
  try {
    const res = await fetch("/api/feature-flags", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      featureEnabled = Boolean(j?.chatV2Enabled);
    }
  } catch {
    // ignorar
  } finally {
    featureChecked = true;
  }
}

export function getPusherClient(): Pusher | null {
  if (client) return client;
  
  // Gateo por feature flag consultado en runtime (servidor decide)
  if (!featureChecked) {
    void ensureFeatureFlagLoaded();
    return null;
  }
  
  if (!featureEnabled) return null;
  
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY as string | undefined;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string | undefined;
  
  if (!key || !cluster) {
    console.error('Pusher key or cluster not configured');
    return null;
  }

  try {
    client = new Pusher(key, {
      cluster,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      disabledTransports: ['sockjs', 'xhr_polling', 'xhr_streaming'],
      authEndpoint: "/api/pusher/auth",
      auth: {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      },
      // Configuración de reconexión
      activityTimeout: 120000, // 2 minutos
      pongTimeout: 10000, // 10 segundos
      unavailableTimeout: 30000, // 30 segundos
    });

    // Manejadores de estado de conexión
    client.connection.bind('state_change', (states: { previous: PusherConnectionState; current: PusherConnectionState }) => {
      connectionState = states.current;
      stateHandlers.forEach(handler => handler(states.current));
      
      if (states.current === 'connected') {
        console.log('Pusher connected successfully');
      } else if (states.current === 'failed' || states.current === 'unavailable') {
        console.warn('Pusher connection failed or unavailable');
      }
    });

    // Manejador de errores global
    client.connection.bind('error', (err: any) => {
      console.error('Pusher connection error:', err);
      errorHandlers.forEach(handler => handler({ type: 'connection', error: err }));
    });

    return client;
  } catch (error) {
    console.error('Failed to initialize Pusher:', error);
    return null;
  }
}

export function subscribePrivate(channelName: string, options: {
  onSubscriptionSucceeded?: () => void;
  onSubscriptionError?: (status: number) => void;
  onError?: (error: any) => void;
} = {}): Channel | null {
  const p = getPusherClient();
  if (!p) return null;

  try {
    const ch = p.subscribe(channelName);
    if (channelRegistry.size + 1 > MAX_CHANNELS_SOFT) {
      console.warn(`[pusher] Soft limit de canales superado (${channelRegistry.size + 1}/${MAX_CHANNELS_SOFT}).`, Array.from(channelRegistry.values()));
    }
    
    if (options.onSubscriptionSucceeded || options.onSubscriptionError) {
      ch.bind('pusher:subscription_succeeded', () => {
        if (!channelRegistry.has(channelName)) {
          channelRegistry.add(channelName);
          channelOrder.push(channelName);
        }
        options.onSubscriptionSucceeded?.();
      });
      
      ch.bind('pusher:subscription_error', (status: number) => {
        options.onSubscriptionError?.(status);
      });
    }

    if (options.onError) {
      ch.bind('pusher:subscription_error', (err: any) => {
        options.onError?.(err);
      });
    }

    return ch;
  } catch (error) {
    console.error(`Error subscribing to channel ${channelName}:`, error);
    return null;
  }
}

export function getConnectionState(): PusherConnectionState {
  return connectionState;
}

export function onConnectionStateChange(handler: ConnectionStateHandler): () => void {
  stateHandlers.add(handler);
  // Llamar inmediatamente con el estado actual
  handler(connectionState);
  
  return () => {
    stateHandlers.delete(handler);
  };
}

export function onError(handler: ErrorHandler): () => void {
  errorHandlers.add(handler);
  
  return () => {
    errorHandlers.delete(handler);
  };
}

export function disconnect(): void {
  if (client) {
    client.disconnect();
    client = null;
    connectionState = 'disconnected';
    try { channelRegistry.clear(); channelOrder.length = 0; } catch {}
  }
}

export function reconnect(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
  getPusherClient(); // Esto forzará una nueva conexión
}

// Utilities de monitoreo y limpieza
export function getSubscribedChannelsCount(): number {
  return channelRegistry.size;
}

export function getSubscribedChannels(): string[] {
  return Array.from(channelRegistry.values());
}

export function safeUnsubscribe(channelName: string): void {
  try {
    const p = getPusherClient();
    p?.unsubscribe(channelName);
  } finally {
    try {
      channelRegistry.delete(channelName);
      const idx = channelOrder.indexOf(channelName);
      if (idx >= 0) channelOrder.splice(idx, 1);
    } catch {}
  }
}

