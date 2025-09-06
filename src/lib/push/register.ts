/* Cliente de registro y suscripción a Web Push (Service Worker) */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerAndSubscribePush(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !(window as any).PushManager) return;

    // Registrar SW si no está
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (e) {
        return;
      }
    }

    // Asegurar permiso de notificaciones
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch {}
      }
      if (Notification.permission !== 'granted') {
        // Sin permiso, salir silenciosamente
        return;
      }
    } else {
      return;
    }

    // Obtener o crear suscripción
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Enviar al backend por si no está guardado
      try {
        const raw = existing.toJSON() as any;
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys })
        });
      } catch {}
      return;
    }

    const pubKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
    if (!pubKey) {
      // Sin clave pública no podemos suscribir
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pubKey) as unknown as BufferSource,
    });

    try {
      const raw = sub.toJSON() as any;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys })
      });
    } catch {}
  } catch {}
}

export async function unsubscribePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const raw = sub.toJSON() as any;
    try {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: raw.endpoint })
      });
    } catch {}
    try { await sub.unsubscribe(); } catch {}
  } catch {}
}
