-- Consolidate SELECT policies on public.products to avoid multiple permissive policies for role authenticated
-- Keep anon read for published products; authenticated can read published or own
-- Idempotent and normalized to (select auth.uid())

DO $$
BEGIN
  -- Ensure a single SELECT policy for authenticated
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_select_own'
  ) THEN
    ALTER POLICY products_select_own ON public.products
      TO authenticated
      USING ((published = true) OR (user_id = (select auth.uid())));
  ELSE
    CREATE POLICY products_select_own ON public.products
      FOR SELECT
      TO authenticated
      USING ((published = true) OR (user_id = (select auth.uid())));
  END IF;

  -- Drop broad public policy and recreate scoped anon policy
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='Public read access'
  ) THEN
    DROP POLICY "Public read access" ON public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.products'::regclass AND polname='products_select_published_anon'
  ) THEN
    CREATE POLICY products_select_published_anon ON public.products
      FOR SELECT
      TO anon
      USING (published = true);
  END IF;
END $$;
