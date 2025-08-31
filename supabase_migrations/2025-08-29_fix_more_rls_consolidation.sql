-- Fix additional RLS initplan and consolidate duplicate permissive policies safely
-- Idempotent via IF EXISTS / IF NOT EXISTS guards

-- 1) credit_transactions: normalize auth.uid()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.credit_transactions'::regclass AND polname='credit_tx_insert_own') THEN
    ALTER POLICY credit_tx_insert_own ON public.credit_transactions
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.credit_transactions'::regclass AND polname='credit_tx_select_own') THEN
    ALTER POLICY credit_tx_select_own ON public.credit_transactions
      USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- 2) chat_conversations: normalize auth.uid() inside EXISTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.chat_conversations'::regclass AND polname='chat_conversations_select_member') THEN
    ALTER POLICY chat_conversations_select_member ON public.chat_conversations
      USING (EXISTS ( SELECT 1 FROM chat_conversation_members m
                      WHERE m.conversation_id = chat_conversations.id
                        AND m.user_id = (select auth.uid())));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.chat_conversations'::regclass AND polname='chat_conversations_update_member') THEN
    ALTER POLICY chat_conversations_update_member ON public.chat_conversations
      USING (EXISTS ( SELECT 1 FROM chat_conversation_members m
                      WHERE m.conversation_id = chat_conversations.id
                        AND m.user_id = (select auth.uid())))
      WITH CHECK (EXISTS ( SELECT 1 FROM chat_conversation_members m
                           WHERE m.conversation_id = chat_conversations.id
                             AND m.user_id = (select auth.uid())));
  END IF;
END $$;

-- 3) chat_conversation_members: normalize auth.uid()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.chat_conversation_members'::regclass AND polname='chat_conversation_members_insert_restrict') THEN
    ALTER POLICY chat_conversation_members_insert_restrict ON public.chat_conversation_members
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.chat_conversation_members'::regclass AND polname='chat_conversation_members_select_self') THEN
    ALTER POLICY chat_conversation_members_select_self ON public.chat_conversation_members
      USING (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.chat_conversation_members'::regclass AND polname='chat_conversation_members_update_self') THEN
    ALTER POLICY chat_conversation_members_update_self ON public.chat_conversation_members
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

-- 4) profile_likes: normalize and consolidate duplicates while preserving logic (no auto-like oneself)
DO $$
BEGIN
  -- Tighten insert to include self-like prevention
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profile_likes'::regclass AND polname='profile_likes_insert_own') THEN
    ALTER POLICY profile_likes_insert_own ON public.profile_likes
      WITH CHECK (((select auth.uid()) = liker_user_id AND liker_user_id <> target_seller_id));
  END IF;
  -- Normalize delete own
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profile_likes'::regclass AND polname='profile_likes_delete_own') THEN
    ALTER POLICY profile_likes_delete_own ON public.profile_likes
      USING ((select auth.uid()) = liker_user_id);
  END IF;
  -- Drop redundant authenticated variants (public ones already allow the same or stricter)
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profile_likes'::regclass AND polname='Users can like other profiles') THEN
    DROP POLICY "Users can like other profiles" ON public.profile_likes;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profile_likes'::regclass AND polname='Users can remove their own likes') THEN
    DROP POLICY "Users can remove their own likes" ON public.profile_likes;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profile_likes'::regclass AND polname='Profile likes can be read by authenticated users') THEN
    DROP POLICY "Profile likes can be read by authenticated users" ON public.profile_likes;
  END IF;
END $$;

-- 5) product_images: remove redundant policies (public SELECT already exists); keep single DELETE own
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.product_images'::regclass AND polname='product_images_select_own') THEN
    DROP POLICY product_images_select_own ON public.product_images;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.product_images'::regclass AND polname='Delete own product images') THEN
    DROP POLICY "Delete own product images" ON public.product_images;
  END IF;
END $$;

-- 6) plans: consolidate SELECT into a single public policy and narrow service role to writes only
DO $$
BEGIN
  -- Drop extra SELECT policies
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='Authenticated read plans') THEN
    DROP POLICY "Authenticated read plans" ON public.plans;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='Public read access (authenticated)') THEN
    DROP POLICY "Public read access (authenticated)" ON public.plans;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='Public read access (anon)') THEN
    DROP POLICY "Public read access (anon)" ON public.plans;
  END IF;
  -- Ensure single SELECT policy exists
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='plans_select_all') THEN
    CREATE POLICY plans_select_all ON public.plans FOR SELECT TO public USING (true);
  END IF;
  -- Recreate service role write-only policies (avoid SELECT to reduce duplicates)
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='Service role write access') THEN
    DROP POLICY "Service role write access" ON public.plans;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='plans_service_role_insert') THEN
    CREATE POLICY plans_service_role_insert ON public.plans FOR INSERT TO public
      USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='plans_service_role_update') THEN
    CREATE POLICY plans_service_role_update ON public.plans FOR UPDATE TO public
      USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='plans_service_role_delete') THEN
    CREATE POLICY plans_service_role_delete ON public.plans FOR DELETE TO public
      USING ((select auth.role()) = 'service_role');
  END IF;
END $$;
