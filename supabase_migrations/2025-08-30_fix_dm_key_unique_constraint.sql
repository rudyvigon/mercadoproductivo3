-- Fix: Reemplazar índice único parcial por UNIQUE CONSTRAINT en dm_key
-- Contexto: el endpoint POST /api/chat/conversations/start usa upsert({ onConflict: "dm_key" })
-- Postgres requiere una constraint única (o índice único NO parcial) para ON CONFLICT por columnas.
-- Esta migración alinea el esquema con ese requisito.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_chat_conversations_dm_key'
  ) THEN
    DROP INDEX public.uq_chat_conversations_dm_key;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'chat_conversations' AND c.conname = 'chat_conversations_dm_key_key'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD CONSTRAINT chat_conversations_dm_key_key UNIQUE (dm_key);
  END IF;
END $$;
