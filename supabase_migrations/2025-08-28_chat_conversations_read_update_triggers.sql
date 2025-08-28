-- Decremento de unread al marcar como READ
-- Mensajes: decrementa unread_seller_count (mensajes entrantes al vendedor)
create or replace function public.tg_messages_after_update_delivery()
returns trigger
language plpgsql
as $$
begin
  -- Sólo actuar cuando cambia a 'read'
  if tg_op = 'UPDATE' and new.delivery_status = 'read' and coalesce(old.delivery_status, '') <> 'read' then
    -- Ignorar placeholder (start-by-seller)
    if trim(coalesce(new.body, '')) = '—' and new.status = 'replied' then
      return null;
    end if;

    update public.conversations c
       set unread_seller_count = greatest(c.unread_seller_count - 1, 0),
           updated_at = now()
     where c.seller_id = new.seller_id
       and c.buyer_email = new.sender_email;
  end if;
  return null;
end
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_messages_after_update_delivery
  AFTER UPDATE OF delivery_status ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_messages_after_update_delivery();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Replies: decrementa unread del receptor: si reply es del vendedor -> unread_buyer_count, si reply es del comprador -> unread_seller_count
create or replace function public.tg_replies_after_update_delivery()
returns trigger
language plpgsql
as $$
declare
  msg record;
  is_seller boolean;
begin
  if tg_op = 'UPDATE' and new.delivery_status = 'read' and coalesce(old.delivery_status, '') <> 'read' then
    select id, seller_id, sender_email into msg from public.messages where id = new.message_id;
    if msg.id is null then
      return null;
    end if;

    is_seller := (new.sender_id = msg.seller_id);
    if is_seller then
      -- Vendedor envió; comprador lee -> bajar unread_buyer_count
      update public.conversations c
         set unread_buyer_count = greatest(c.unread_buyer_count - 1, 0),
             updated_at = now()
       where c.seller_id = msg.seller_id
         and c.buyer_email = msg.sender_email;
    else
      -- Comprador envió; vendedor lee -> bajar unread_seller_count
      update public.conversations c
         set unread_seller_count = greatest(c.unread_seller_count - 1, 0),
             updated_at = now()
       where c.seller_id = msg.seller_id
         and c.buyer_email = msg.sender_email;
    end if;
  end if;
  return null;
end
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_replies_after_update_delivery
  AFTER UPDATE OF delivery_status ON public.message_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_replies_after_update_delivery();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
