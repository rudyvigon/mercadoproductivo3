-- Corrige ambigüedad de columna "featured_until" en sp_feature_product
-- Califica la columna con alias de tabla y mantiene la lógica sin created_at en usage_counters

create or replace function public.sp_feature_product(
  p_product uuid,
  p_days int,
  p_cost int
)
returns table(
  remaining_credits int,
  featured_until timestamptz
)
language plpgsql
security definer
set search_path = public as $$
declare
  v_uid uuid;
  v_plan_code text;
  v_credits_monthly int := 0;
  v_period_ym int;
  v_used int := 0;
  v_new_used int;
  v_until timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_days is null or p_days <= 0 then
    raise exception 'Días inválidos';
  end if;
  if p_cost is null or p_cost <= 0 then
    raise exception 'Costo inválido';
  end if;

  -- Verificar propiedad del producto
  if not exists(select 1 from public.products where id = p_product and user_id = v_uid) then
    raise exception 'Producto inexistente o no pertenece al usuario';
  end if;

  -- Plan y créditos mensuales
  select plan_code into v_plan_code from public.profiles where id = v_uid;
  if v_plan_code is null then
    v_credits_monthly := 0;
  else
    select coalesce(credits_monthly, 0) into v_credits_monthly from public.plans where code = v_plan_code;
  end if;

  -- Período actual YYYYMM
  v_period_ym := extract(year from now())::int * 100 + extract(month from now())::int;

  -- Asegurar fila de usage_counters
  insert into public.usage_counters(user_id, period_ym, credits_used)
  values (v_uid, v_period_ym, 0)
  on conflict (user_id, period_ym) do nothing;

  -- Leer uso actual
  select coalesce(credits_used, 0) into v_used
  from public.usage_counters where user_id = v_uid and period_ym = v_period_ym;

  if v_used + p_cost > v_credits_monthly then
    raise exception 'Créditos insuficientes para destacar';
  end if;

  -- Consumir créditos
  update public.usage_counters
    set credits_used = credits_used + p_cost
  where user_id = v_uid and period_ym = v_period_ym;

  -- Calcular nueva vigencia de destacado
  update public.products p
     set featured_until = greatest(coalesce(p.featured_until, now()), now()) + make_interval(days => p_days)
   where p.id = p_product
  returning p.featured_until into v_until;

  -- Registrar transacción
  insert into public.credit_transactions(user_id, product_id, type, amount, meta)
  values (v_uid, p_product, 'feature', p_cost, jsonb_build_object('days', p_days));

  -- Valores de retorno
  select credits_used into v_new_used from public.usage_counters where user_id = v_uid and period_ym = v_period_ym;
  remaining_credits := greatest(v_credits_monthly - v_new_used, 0);
  featured_until := v_until;
  return next;
end;
$$;

grant execute on function public.sp_feature_product(uuid,int,int) to authenticated;
