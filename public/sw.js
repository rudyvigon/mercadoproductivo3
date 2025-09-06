/*
  Service Worker para notificaciones push de Mercado Productivo.
  - Maneja el evento 'push' para mostrar notificaciones.
  - Maneja 'notificationclick' para enfocar/abrir la app.
*/

self.addEventListener('install', (event) => {
  // Activación inmediata en nuevas versiones
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Tomar control de clientes abiertos
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  try {
    const dataText = event.data ? event.data.text() : '';
    let data = {};
    try { data = JSON.parse(dataText || '{}'); } catch { data = { body: dataText || '' }; }

    const title = data.title || 'Nuevo mensaje';
    const body = data.body || 'Tienes novedades';
    const url = data.url || '/dashboard/messages';
    const icon = data.icon || '/favicon.ico';

    const options = {
      body,
      icon,
      data: { url },
      badge: '/favicon.ico',
      tag: 'mp-chat',
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // noop
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/dashboard/messages';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Intentar enfocar una pestaña existente
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if ('focus' in client) {
            await client.focus();
            if ('navigate' in client && typeof client.navigate === 'function') {
              try { await client.navigate(targetUrl); } catch {}
            }
            return;
          }
        } catch {}
      }
      // Si no hay clientes, abrir una nueva ventana
      if (self.clients.openWindow) {
        try { await self.clients.openWindow(targetUrl); } catch {}
      }
    })()
  );
});
