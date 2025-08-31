-- Normalize chat_messages RLS to avoid auth_rls_initplan lint
-- Idempotent via IF EXISTS

DO $$
BEGIN
  -- INSERT policy: sender must match and be member of the conversation
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.chat_messages'::regclass
      AND polname='chat_messages_insert_sender_member'
  ) THEN
    ALTER POLICY chat_messages_insert_sender_member ON public.chat_messages
      WITH CHECK (
        (sender_id = (select auth.uid()))
        AND EXISTS (
          SELECT 1
          FROM chat_conversation_members m
          WHERE m.conversation_id = chat_messages.conversation_id
            AND m.user_id = (select auth.uid())
        )
      );
  END IF;

  -- SELECT policy: only members can read messages
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.chat_messages'::regclass
      AND polname='chat_messages_select_member'
  ) THEN
    ALTER POLICY chat_messages_select_member ON public.chat_messages
      USING (
        EXISTS (
          SELECT 1
          FROM chat_conversation_members m
          WHERE m.conversation_id = chat_messages.conversation_id
            AND m.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;
