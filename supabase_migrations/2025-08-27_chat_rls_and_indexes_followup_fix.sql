-- Índices adicionales
create index if not exists idx_conversations_first_message_id on public.conversations(first_message_id);
create index if not exists idx_conversations_last_reply_id on public.conversations(last_reply_id);
create index if not exists idx_messages_seller_email_created on public.messages(seller_id, sender_email, created_at);
create index if not exists idx_message_replies_message_id_created on public.message_replies(message_id, created_at);

-- Habilitar RLS en tablas nuevas
alter table public.conversations enable row level security;
alter table public.message_attachments enable row level security;

-- Políticas de lectura
DO $$ BEGIN
  CREATE POLICY conversations_select_self ON public.conversations
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR buyer_email = auth.email());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY message_attachments_select_self ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from public.messages m
      where m.id = public.message_attachments.message_id
        and (m.seller_id = auth.uid() or m.sender_email = auth.email())
    )
    or exists (
      select 1 from public.message_replies r
      join public.messages m2 on m2.id = r.message_id
      where r.id = public.message_attachments.reply_id
        and (m2.seller_id = auth.uid() or m2.sender_email = auth.email())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
