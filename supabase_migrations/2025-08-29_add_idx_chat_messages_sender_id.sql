-- Migration: add_idx_chat_messages_sender_id
-- Contexto: cubrir FK para rendimiento en chat_messages.sender_id
-- Seguro en re-ejecuciones: IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
  ON public.chat_messages USING btree (sender_id);
