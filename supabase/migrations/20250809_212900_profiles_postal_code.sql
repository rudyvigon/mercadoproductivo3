-- Agrega columna postal_code (CP) a public.profiles si no existe
-- No modifica datos existentes

begin;

alter table if exists public.profiles
  add column if not exists postal_code text;

comment on column public.profiles.postal_code is 'Código Postal (opcional)';

commit;
