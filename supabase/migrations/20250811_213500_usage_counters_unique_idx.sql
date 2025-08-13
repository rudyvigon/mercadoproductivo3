-- Asegura ON CONFLICT (user_id, period_ym) en usage_counters
-- Crea índice único para permitir upsert sin error
create unique index if not exists usage_counters_user_period_unique
  on public.usage_counters(user_id, period_ym);
