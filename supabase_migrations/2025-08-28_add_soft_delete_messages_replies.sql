-- Soft-delete para mensajes y replies
begin;

alter table public.messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists idx_messages_deleted_at on public.messages(deleted_at) where deleted_at is not null;

alter table public.message_replies
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists idx_message_replies_deleted_at on public.message_replies(deleted_at) where deleted_at is not null;

commit;
