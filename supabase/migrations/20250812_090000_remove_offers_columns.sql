-- Elimina columnas relacionadas a "ofertas" ya obsoletas
-- Alineado con el nuevo sistema de créditos para destacar productos

-- Remover límite de ofertas por plan
alter table if exists public.plans
  drop column if exists offers_per_month;

-- Remover contador de ofertas creadas por período
alter table if exists public.usage_counters
  drop column if exists offers_created;
