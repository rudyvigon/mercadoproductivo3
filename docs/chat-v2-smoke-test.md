# Chat V2 – Smoke Test E2E

Este documento guía un smoke test end-to-end para validar Chat V2: gating por feature flag, membresía, inserción de mensajes, eventos Pusher y reflejo en UI.

## Pre-requisitos
- `.env.local` con flags y credenciales activas:
  - `FEATURE_CHAT_V2_ENABLED=true`
  - `NEXT_PUBLIC_FEATURE_CHAT_V2_ENABLED=true`
  - Supabase URL/keys y Pusher (APP_ID, KEY, SECRET, CLUSTER) válidos.
- Migración SQL de Chat V2 aplicada (tablas `chat_conversations`, `chat_conversation_members`, `chat_messages`, triggers y RPC `chat_list_conversations`).

## Datos de prueba (existentes)
- Usuario A (seller): `f3da1efc-d8cf-45c8-b52a-4aa2d0d71a36` ("Tester MP")
- Usuario B (seller): `59c093d2-f5d6-41b9-9dd7-5440ec213688` ("Mario Luna")
- Conversación DM: `bad87870-06e6-4a13-b9da-3bd5b79e3483`
- dm_key: `dm:59c093d2-f5d6-41b9-9dd7-5440ec213688-f3da1efc-d8cf-45c8-b52a-4aa2d0d71a36`

## Endpoints y eventos relevantes
- Listado de conversaciones: `GET /api/chat/conversations`
- Mensajes de conversación: `GET/POST /api/chat/conversations/{id}/messages` (columna `body`)
- Marcar conversación leída: `POST /api/chat/conversations/{id}/read`
- Ocultar conversación: `POST /api/chat/conversations/{id}/hide`
- Restaurar conversación: `DELETE /api/chat/conversations/{id}/hide`
- Auth de Pusher: `POST /api/pusher/auth`
- Eventos Pusher:
  - `private-conversation-{id}` → `chat:message:new`
  - `private-user-{userId}` → `chat:conversation:updated` | `chat:conversation:hidden` | `chat:conversation:restored` | `chat:conversation:read`

## Paso a paso UI (usuario seller logueado)
1. Iniciar app:
   - `npm install`
   - `npm run dev` → http://localhost:3000
2. Iniciar sesión como seller (p.ej., "Tester MP").
3. Ir a `Dashboard → Mensajes` (`/dashboard/messages`).
4. Validar que aparece la conversación con preview.
5. Abrir la conversación (componentes `MessagesInboxV2` → `SellerConversationWindow`).
6. Esperado al abrir:
   - Carga de historial: `GET /api/chat/conversations/{id}/messages`.
   - Llamada `POST /api/chat/conversations/{id}/read` para resetear `unread_count`.
   - Suscripción Pusher al canal `private-conversation-{id}` y al `private-user-{uid}`.
7. Enviar un mensaje desde el input:
   - `POST /api/chat/conversations/{id}/messages` (payload `{ body: string }`).
   - UI agrega el mensaje (optimista) y luego llega `chat:message:new`.
   - Inbox recibe `chat:conversation:updated` por `private-user-{uid}`.
8. Probar ocultar/restaurar desde la bandeja:
   - Ocultar: `POST /api/chat/conversations/{id}/hide` → evento `chat:conversation:hidden`.
   - Restaurar: `DELETE /api/chat/conversations/{id}/hide` → evento `chat:conversation:restored`.
9. (Opcional) Validar cross-usuario:
   - Abrir otra sesión como el segundo usuario y verificar realtime bidireccional.

## Consultas SQL de verificación (Supabase)
- Mensajes recientes de la conversación:
```sql
select id, sender_id, body, created_at
from public.chat_messages
where conversation_id = 'bad87870-06e6-4a13-b9da-3bd5b79e3483'
order by created_at desc
limit 10;
```
- Miembros y contadores:
```sql
select conversation_id, user_id, hidden_at, last_read_at, unread_count
from public.chat_conversation_members
where conversation_id = 'bad87870-06e6-4a13-b9da-3bd5b79e3483'
order by user_id;
```
- Listado por usuario (RPC):
```sql
select * from public.chat_list_conversations('f3da1efc-d8cf-45c8-b52a-4aa2d0d71a36'::uuid, true)
order by last_created_at desc nulls last
limit 5;
```

## Troubleshooting
- HTTP 410 en rutas `/api/chat/**`: revisar flags `FEATURE_CHAT_V2_ENABLED` y `NEXT_PUBLIC_FEATURE_CHAT_V2_ENABLED`.
- 401/403 en APIs: sesión o membresía de conversación; validar `chat_conversation_members`.
- Pusher no autoriza: revisar `POST /api/pusher/auth` y variables de Pusher.
- La UI no actualiza inbox: revisar eventos por `private-user-{uid}` y consola (errores de Pusher).

## Referencias de código
- UI bandeja: `src/components/messages/messages-inbox-v2.tsx`
- Ventana conversación: `src/components/chat/seller-conversation-window.tsx`
- Input envío: `src/components/chat/conversation-chat-input.tsx`
- Auth Pusher server: `src/app/api/pusher/auth/route.ts`
- Mensajes API: `src/app/api/chat/conversations/[id]/messages/route.ts`
- Ocultar/Restaurar: `src/app/api/chat/conversations/[id]/hide/route.ts`
- Marcar leído: `src/app/api/chat/conversations/[id]/read/route.ts`
