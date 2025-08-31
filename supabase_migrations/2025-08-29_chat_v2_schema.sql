-- Chat V2: esquema base, RLS, triggers, RPC
-- Requiere: extensión pgcrypto para gen_random_uuid()
create extension if not exists pgcrypto;

-- Tabla de conversaciones (DMs)
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  dm_key text null,
  preview text null,
  last_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Único parcial para DMs (una conversación por par)
create unique index if not exists uq_chat_conversations_dm_key
  on public.chat_conversations(dm_key)
  where dm_key is not null;

-- Miembros de conversación (per-user state)
create table if not exists public.chat_conversation_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unread_count integer not null default 0,
  hidden_at timestamptz null,
  last_read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_chat_conversation_members_user on public.chat_conversation_members(user_id);
create index if not exists idx_chat_conversation_members_conv on public.chat_conversation_members(conversation_id);

-- Mensajes de conversación
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_conv_created on public.chat_messages(conversation_id, created_at);

-- RLS
alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_messages enable row level security;

-- Políticas de chat_conversation_members (acceso del propio usuario)
DO $$ BEGIN
  CREATE POLICY chat_conversation_members_select_self ON public.chat_conversation_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY chat_conversation_members_update_self ON public.chat_conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY chat_conversation_members_insert_restrict ON public.chat_conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Políticas de chat_conversations (miembro de la conversación)
DO $$ BEGIN
  CREATE POLICY chat_conversations_select_member ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (exists (
    select 1 from public.chat_conversation_members m
    where m.conversation_id = chat_conversations.id and m.user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY chat_conversations_update_member ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (exists (
    select 1 from public.chat_conversation_members m
    where m.conversation_id = chat_conversations.id and m.user_id = auth.uid()
  ))
  WITH CHECK (exists (
    select 1 from public.chat_conversation_members m
    where m.conversation_id = chat_conversations.id and m.user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Políticas de chat_messages (miembro puede ver; el remitente puede insertar)
DO $$ BEGIN
  CREATE POLICY chat_messages_select_member ON public.chat_messages
  FOR SELECT TO authenticated
  USING (exists (
    select 1 from public.chat_conversation_members m
    where m.conversation_id = chat_messages.conversation_id and m.user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY chat_messages_insert_sender_member ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() and exists (
      select 1 from public.chat_conversation_members m
      where m.conversation_id = chat_messages.conversation_id and m.user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers: mantener preview/last_message_at y contadores/unhide
create or replace function public.tg_chat_messages_after_insert()
returns trigger
language plpgsql
as $$
begin
  -- Actualizar conversación
  update public.chat_conversations c
     set last_message_at = greatest(coalesce(c.last_message_at, new.created_at), new.created_at),
         preview = left(coalesce(new.body, ''), 200),
         updated_at = now()
   where c.id = new.conversation_id;

  -- Desocultar conversación por nueva actividad
  update public.chat_conversation_members cm
     set hidden_at = null,
         updated_at = now()
   where cm.conversation_id = new.conversation_id;

  -- Incrementar unread a todos excepto al remitente
  update public.chat_conversation_members cm
     set unread_count = cm.unread_count + 1,
         updated_at = now()
   where cm.conversation_id = new.conversation_id
     and cm.user_id <> new.sender_id;

  return null;
end
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_chat_messages_after_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_after_insert();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC: listar conversaciones del usuario con preview/unread/hidden
create or replace function public.chat_list_conversations(
  p_user uuid,
  p_include_hidden boolean default true
)
returns table (
  id uuid,
  counterparty_id uuid,
  counterparty_name text,
  counterparty_avatar_url text,
  last_created_at timestamptz,
  preview text,
  unread_count integer,
  hidden_at timestamptz
)
language sql
as $$
  with mine as (
    select cm.conversation_id,
           cm.unread_count,
           cm.hidden_at,
           c.last_message_at,
           c.preview
    from public.chat_conversation_members cm
    join public.chat_conversations c on c.id = cm.conversation_id
    where cm.user_id = p_user
      and (p_include_hidden or cm.hidden_at is null)
  ),
  other as (
    -- Suponiendo DMs (2 miembros): tomar un counterparty
    select distinct on (cm.conversation_id) cm.conversation_id, cm.user_id as counterparty_id
    from public.chat_conversation_members cm
    where cm.user_id <> p_user
    order by cm.conversation_id, cm.user_id
  )
  select m.conversation_id as id,
         o.counterparty_id,
         p.full_name as counterparty_name,
         p.avatar_url as counterparty_avatar_url,
         m.last_message_at as last_created_at,
         m.preview,
         m.unread_count,
         m.hidden_at
  from mine m
  left join other o on o.conversation_id = m.conversation_id
  left join public.profiles p on p.id = o.counterparty_id
  order by m.last_message_at desc nulls last;
$$;
