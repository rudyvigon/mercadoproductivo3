-- Consolidate duplicate permissive RLS policies on public.products
-- Keep single policy per action for role 'authenticated' and normalize (select auth.uid())
-- Idempotent via IF EXISTS / IF NOT EXISTS

DO $$
BEGIN
  -- 1) INSERT: keep only 'Insert own products' and normalize
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='Insert own products'
  ) THEN
    ALTER POLICY "Insert own products" ON public.products
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_insert_if_profile_has_cp'
  ) THEN
    DROP POLICY products_insert_if_profile_has_cp ON public.products;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_insert_owner_with_plan'
  ) THEN
    DROP POLICY products_insert_owner_with_plan ON public.products;
  END IF;

  -- 2) SELECT: keep only one for authenticated (products_select_own) and normalize
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_select_own'
  ) THEN
    ALTER POLICY products_select_own ON public.products
      USING (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_own_select'
  ) THEN
    DROP POLICY products_own_select ON public.products;
  END IF;

  -- 3) UPDATE: keep only products_update_own and normalize
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_update_own'
  ) THEN
    ALTER POLICY products_update_own ON public.products
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='Update own products'
  ) THEN
    DROP POLICY "Update own products" ON public.products;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_own_update'
  ) THEN
    DROP POLICY products_own_update ON public.products;
  END IF;

  -- 4) DELETE: keep only products_delete_own and normalize
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_delete_own'
  ) THEN
    ALTER POLICY products_delete_own ON public.products
      USING (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='Delete own products'
  ) THEN
    DROP POLICY "Delete own products" ON public.products;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_own_delete'
  ) THEN
    DROP POLICY products_own_delete ON public.products;
  END IF;
END $$;
