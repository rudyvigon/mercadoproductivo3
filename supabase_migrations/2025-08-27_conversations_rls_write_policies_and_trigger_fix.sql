-- Políticas de escritura en conversations para participantes
DO $$ BEGIN
  CREATE POLICY conversations_insert_self ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() OR buyer_email = auth.email());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY conversations_update_self ON public.conversations
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR buyer_email = auth.email())
  WITH CHECK (seller_id = auth.uid() OR buyer_email = auth.email());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ajuste: evitar last_activity_at nulo en triggers
create or replace function public.tg_messages_after_insert()
returns trigger
language plpgsql
as $$
declare
  conv_id uuid;
  is_placeholder boolean;
begin
  insert into public.conversations (seller_id, buyer_email, first_message_id, last_activity_at, updated_at)
    values (new.seller_id, new.sender_email, new.id, new.created_at, now())
  on conflict (seller_id, buyer_email) do update set updated_at = now()
  returning id into conv_id;

  update public.conversations
     set first_message_id = coalesce(first_message_id, new.id),
         last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at),
         updated_at = now()
   where id = conv_id;

  is_placeholder := (trim(coalesce(new.body,'')) = '—' and new.status = 'replied');
  if not is_placeholder then
    update public.conversations
       set unread_seller_count = unread_seller_count + 1,
           updated_at = now()
     where id = conv_id;
  end if;
  return null;
end
$$;

create or replace function public.tg_replies_after_insert()
returns trigger
language plpgsql
as $$
declare
  msg record;
  is_seller boolean;
  conv_id uuid;
begin
  select id, seller_id, sender_email, created_at into msg from public.messages where id = new.message_id;
  if msg.id is null then
    return null;
  end if;

  insert into public.conversations (seller_id, buyer_email, first_message_id, last_activity_at, updated_at)
    values (msg.seller_id, msg.sender_email, msg.id, new.created_at, now())
  on conflict (seller_id, buyer_email) do update set updated_at = now()
  returning id into conv_id;

  update public.conversations
     set last_reply_id = new.id,
         last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at),
         updated_at = now()
   where id = conv_id;

  is_seller := (new.sender_id = msg.seller_id);
  if is_seller then
    update public.conversations
       set unread_buyer_count = unread_buyer_count + 1,
           updated_at = now()
     where id = conv_id;
  else
    update public.conversations
       set unread_seller_count = unread_seller_count + 1,
           updated_at = now()
     where id = conv_id;
  end if;
  return null;
end
$$;
