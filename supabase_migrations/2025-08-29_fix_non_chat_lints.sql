-- Fix non-chat lints: RLS policies, FK indexes, duplicate indexes, policy consolidation, function search_path
-- Safe to run multiple times due to IF EXISTS / IF NOT EXISTS guards where applicable.

-- 1) Performance: add missing FK indexes
create index if not exists idx_credit_transactions_product_id on public.credit_transactions (product_id);
create index if not exists idx_profiles_role_code on public.profiles (role_code);

-- 2) Performance: drop duplicate index on usage_counters (PK already covers user_id, period_ym)
drop index if exists public.usage_counters_user_period_unique;

-- 3) Security: billing_events has RLS enabled but no policies -> add read-own policy
-- Note: service role bypasses RLS, no need for write policy here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.billing_events'::regclass AND polname = 'billing_events_select_own'
  ) THEN
    CREATE POLICY billing_events_select_own
      ON public.billing_events
      FOR SELECT
      TO authenticated
      USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- 4) Consolidate profiles policies (remove duplicates) and normalize to use (select auth.uid())
DROP POLICY IF EXISTS "Public read access" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- Ensure SELECT own policy exists and uses (select auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profiles'::regclass AND polname='read own profile') THEN
    ALTER POLICY "read own profile" ON public.profiles USING (id = (select auth.uid()));
  ELSE
    CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = (select auth.uid()));
  END IF;
END $$;

-- Ensure UPDATE own policy exists and uses (select auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profiles'::regclass AND polname='update own profile') THEN
    ALTER POLICY "update own profile" ON public.profiles USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));
  ELSE
    CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));
  END IF;
END $$;

-- Keep/ensure INSERT & DELETE own
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profiles'::regclass AND polname='Users can insert their own profile') THEN
    ALTER POLICY "Users can insert their own profile" ON public.profiles WITH CHECK (id = (select auth.uid()));
  ELSE
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = (select auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.profiles'::regclass AND polname='Users can delete own profile') THEN
    ALTER POLICY "Users can delete own profile" ON public.profiles USING (id = (select auth.uid()));
  ELSE
    CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (id = (select auth.uid()));
  END IF;
END $$;

-- 5) roles policies: replace broad ALL policy with granular write policies
DROP POLICY IF EXISTS "Solo admins pueden modificar roles" ON public.roles;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.roles'::regclass AND polname='roles_admins_can_insert') THEN
    CREATE POLICY roles_admins_can_insert ON public.roles
      FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) IN (SELECT id FROM public.profiles WHERE role_code='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.roles'::regclass AND polname='roles_admins_can_update') THEN
    CREATE POLICY roles_admins_can_update ON public.roles
      FOR UPDATE TO authenticated
      USING ((select auth.uid()) IN (SELECT id FROM public.profiles WHERE role_code='admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.roles'::regclass AND polname='roles_admins_can_delete') THEN
    CREATE POLICY roles_admins_can_delete ON public.roles
      FOR DELETE TO authenticated
      USING ((select auth.uid()) IN (SELECT id FROM public.profiles WHERE role_code='admin'));
  END IF;
END $$;

-- 6) usage_counters: remove redundant deny-all and normalize own policies
DROP POLICY IF EXISTS usage_counters_deny_all ON public.usage_counters;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.usage_counters'::regclass AND polname='usage_counters_insert_own') THEN
    ALTER POLICY usage_counters_insert_own ON public.usage_counters WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.usage_counters'::regclass AND polname='usage_counters_select_own') THEN
    ALTER POLICY usage_counters_select_own ON public.usage_counters USING (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.usage_counters'::regclass AND polname='usage_counters_update_own') THEN
    ALTER POLICY usage_counters_update_own ON public.usage_counters USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

-- 7) auth_rls_initplan: normalize common policies in products/product_images to use (select auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='Insert own products') THEN
    ALTER POLICY "Insert own products" ON public.products WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='Update own products') THEN
    ALTER POLICY "Update own products" ON public.products USING (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='Delete own products') THEN
    ALTER POLICY "Delete own products" ON public.products USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- Note: product_images no tiene columna user_id; las políticas actuales usan EXISTS con products(user_id).
-- No se intenta normalizar product_images para evitar errores por columnas inexistentes.

-- 8) Functions: set stable search_path to public for flagged functions (guarded)
DO $$
BEGIN
  -- Cada ALTER está protegido para no fallar si la función no existe (SQLSTATE 42883)
  BEGIN
    ALTER FUNCTION public.apply_credits_on_plan_change() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.clamp_credits_balance() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.enforce_product_images_limit() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.tg_messages_after_insert() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.set_plan_activation_ts() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.tg_messages_after_update_delivery() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.tg_replies_after_update_delivery() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.tg_replies_after_insert() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.enforce_exportador_by_plan() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public._ensure_policy(text,regclass,text,name,text,text) SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.tg_chat_messages_after_insert() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.next_image_seq(integer) SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.chat_list_conversations(uuid,boolean) SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.set_updated_at() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.enforce_max_products() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.normalize_role(text) SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.protect_role_code_change() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.enforce_max_images_per_product() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.enforce_advertiser_plan() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.get_my_profile() SET search_path = public;
  EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;
