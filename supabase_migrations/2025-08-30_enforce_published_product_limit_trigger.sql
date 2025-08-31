-- Trigger para limitar la cantidad de productos publicados (visibles) según el plan del usuario
-- Idempotente: reemplaza función y trigger si ya existen

CREATE OR REPLACE FUNCTION public.enforce_max_published_products()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_code text;
  v_max integer;
  v_count integer;
  v_user uuid;
BEGIN
  -- Determinar si aplica validación según operación/estado de published
  IF TG_OP = 'INSERT' THEN
    -- Solo validar cuando se inserta ya publicado
    IF COALESCE(NEW.published, false) IS NOT TRUE THEN
      RETURN NEW;
    END IF;
    v_user := NEW.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo validar cuando el destino queda publicado
    IF COALESCE(NEW.published, false) IS NOT TRUE THEN
      RETURN NEW;
    END IF;
    -- Si ya estaba publicado y no cambia el owner, no revalidar
    IF COALESCE(OLD.published, false) = true AND COALESCE(NEW.published, false) = true AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id) THEN
      RETURN NEW;
    END IF;
    v_user := NEW.user_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Plan actual del usuario
  SELECT plan_code
    INTO v_plan_code
  FROM public.profiles
  WHERE id = v_user;

  -- Si no hay plan, no aplicar límite
  IF v_plan_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tope del plan. Si no está configurado, no limitar.
  -- Nota: Usamos plans.max_products como tope de publicados.
  SELECT max_products
    INTO v_max
  FROM public.plans
  WHERE code = v_plan_code;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Conteo actual de productos publicados del usuario (en INSERT la fila NEW aún no existe; en UPDATE aún no se materializó)
  SELECT COUNT(*)
    INTO v_count
  FROM public.products
  WHERE user_id = v_user
    AND published = true;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'PUBLISHED_PRODUCT_LIMIT_REACHED'
      USING
        DETAIL = format('Has alcanzado el máximo de %s productos publicados para tu plan (%s).', v_max, v_plan_code),
        HINT = 'Actualiza tu plan en /planes para publicar más productos.';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT y UPDATE (cambio de published/owner)
DROP TRIGGER IF EXISTS trg_enforce_max_published_products ON public.products;
CREATE TRIGGER trg_enforce_max_published_products
  BEFORE INSERT OR UPDATE OF published, user_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_published_products();
