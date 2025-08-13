-- RLS y políticas sin bloques DO/EXECUTE para evitar errores de sintaxis

-- products
alter table if exists public.products enable row level security;
drop policy if exists products_select_own on public.products;
create policy products_select_own on public.products
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- profiles
alter table if exists public.profiles enable row level security;
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- plans (solo lectura)
alter table if exists public.plans enable row level security;
drop policy if exists plans_select_all on public.plans;
create policy plans_select_all on public.plans
  for select to authenticated
  using (true);

-- usage_counters
alter table if exists public.usage_counters enable row level security;
drop policy if exists usage_counters_select_own on public.usage_counters;
create policy usage_counters_select_own on public.usage_counters
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists usage_counters_insert_own on public.usage_counters;
create policy usage_counters_insert_own on public.usage_counters
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists usage_counters_update_own on public.usage_counters;
create policy usage_counters_update_own on public.usage_counters
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- credit_transactions
alter table if exists public.credit_transactions enable row level security;
drop policy if exists credit_tx_select_own on public.credit_transactions;
create policy credit_tx_select_own on public.credit_transactions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists credit_tx_insert_own on public.credit_transactions;
create policy credit_tx_insert_own on public.credit_transactions
  for insert to authenticated
  with check (user_id = auth.uid());
