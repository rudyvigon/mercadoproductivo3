-- Normalize RLS policies to use (select auth.uid()) / (select auth.role()) to avoid re-evaluation per row

-- products: DELETE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_delete_own') THEN
    ALTER POLICY products_delete_own ON public.products USING (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_own_delete') THEN
    ALTER POLICY products_own_delete ON public.products USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- products: SELECT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_own_select') THEN
    ALTER POLICY products_own_select ON public.products USING ((select auth.uid()) = user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_select_own') THEN
    ALTER POLICY products_select_own ON public.products USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- products: UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_update_own') THEN
    ALTER POLICY products_update_own ON public.products USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_own_update') THEN
    ALTER POLICY products_own_update ON public.products USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- products: INSERT (políticas adicionales con condiciones)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_insert_if_profile_has_cp') THEN
    ALTER POLICY products_insert_if_profile_has_cp ON public.products
      WITH CHECK (((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (select auth.uid())) AND (COALESCE(TRIM(BOTH FROM p.postal_code), ''::text) <> ''::text)))));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.products'::regclass AND polname='products_insert_owner_with_plan') THEN
    ALTER POLICY products_insert_owner_with_plan ON public.products
      WITH CHECK ((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM profiles pr WHERE ((pr.id = (select auth.uid())) AND (pr.plan_code IS NOT NULL)))));
  END IF;
END $$;

-- product_images: INSERT/SELECT/DELETE policies use EXISTS with products.user_id = auth.uid()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.product_images'::regclass AND polname='product_images_insert_own') THEN
    ALTER POLICY product_images_insert_own ON public.product_images
      WITH CHECK (EXISTS ( SELECT 1 FROM products pr WHERE ((pr.id = product_images.product_id) AND (pr.user_id = (select auth.uid())))));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.product_images'::regclass AND polname='product_images_select_own') THEN
    ALTER POLICY product_images_select_own ON public.product_images
      USING (EXISTS ( SELECT 1 FROM products pr WHERE ((pr.id = product_images.product_id) AND (pr.user_id = (select auth.uid())))));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.product_images'::regclass AND polname='product_images_delete_own') THEN
    ALTER POLICY product_images_delete_own ON public.product_images
      USING (EXISTS ( SELECT 1 FROM products pr WHERE ((pr.id = product_images.product_id) AND (pr.user_id = (select auth.uid())))));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.product_images'::regclass AND polname='Delete own product images') THEN
    ALTER POLICY "Delete own product images" ON public.product_images
      USING (EXISTS ( SELECT 1 FROM products p WHERE ((p.id = product_images.product_id) AND (p.user_id = (select auth.uid())))));
  END IF;
END $$;

-- plans: service role policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.plans'::regclass AND polname='Service role write access') THEN
    ALTER POLICY "Service role write access" ON public.plans USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END $$;
