// Utilidades de servidor para enviar Web Push de forma opcional (graceful fallback)

let configured = false;

async function getWebPush(): Promise<any | null> {
  try {
    // Intentar importar 'web-push' dinámicamente. Si no existe en dependencias, devolvemos null.
    const mod = await import('web-push');
    return (mod as any).default || (mod as any);
  } catch {
    try { console.warn('[WebPush] Módulo web-push no disponible. Envío deshabilitado.'); } catch {}
    return null;
  }
}

function getVapidKeys(): { publicKey: string | null; privateKey: string | null; contact: string } {
  const pub = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const contact = `mailto:${process.env.NEXT_PUBLIC_APP_NAME || 'Mercado Productivo'}@example.com`;
  return { publicKey: pub || null, privateKey: priv || null, contact };
}

async function ensureConfigured(webPush: any): Promise<boolean> {
  if (configured) return true;
  const { publicKey, privateKey, contact } = getVapidKeys();
  if (!publicKey || !privateKey) {
    try { console.warn('[WebPush] Claves VAPID faltantes. Defina VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY para habilitar Web Push.'); } catch {}
    return false;
  }
  try {
    webPush.setVapidDetails(contact, publicKey, privateKey);
    configured = true;
    return true;
  } catch {
    try { console.warn('[WebPush] Error configurando VAPID. Verifique formato de claves.'); } catch {}
    return false;
  }
}

export type PushKeys = { p256dh?: string; auth?: string };

export async function trySendWebPush(endpoint: string, keys: PushKeys | null, payload: any): Promise<{ ok: boolean; status?: number }> {
  try {
    const webPush = await getWebPush();
    if (!webPush) return { ok: false };
    const ok = await ensureConfigured(webPush);
    if (!ok) {
      try { console.warn('[WebPush] Envío omitido: Web Push no configurado.'); } catch {}
      return { ok: false };
    }

    const sub: any = { endpoint, keys: keys || {} };
    const json = JSON.stringify(payload || {});
    const res = await webPush.sendNotification(sub, json).catch((e: any) => e);

    if (res && typeof res.statusCode === 'number') {
      // web-push arroja errores como objetos con statusCode
      if (res.statusCode >= 200 && res.statusCode < 300) return { ok: true, status: res.statusCode };
      return { ok: false, status: res.statusCode };
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
