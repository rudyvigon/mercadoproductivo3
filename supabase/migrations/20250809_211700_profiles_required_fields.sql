-- Agrega campos requeridos para anunciantes en public.profiles
-- Reglas: agregar solo si no existen y no tocar datos existentes

begin;

alter table if exists public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists dni_cuit text,
  add column if not exists company text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists province text;

comment on column public.profiles.first_name is 'Nombre (requerido para publicar)';
comment on column public.profiles.last_name is 'Apellido (requerido para publicar)';
comment on column public.profiles.dni_cuit is 'Documento/DNI o CUIT (requerido para publicar)';
comment on column public.profiles.company is 'Empresa (opcional)';
comment on column public.profiles.address is 'Dirección (requerido para publicar)';
comment on column public.profiles.city is 'Localidad (requerido para publicar)';
comment on column public.profiles.province is 'Provincia (requerido para publicar)';

-- Índice para búsquedas por DNI/CUIT (no-único)
create index if not exists profiles_dni_cuit_idx on public.profiles (dni_cuit);

-- Completar full_name si está vacío y existen first_name/last_name
update public.profiles p
set full_name = trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
where (p.full_name is null or btrim(p.full_name) = '')
  and coalesce(btrim(first_name), '') <> ''
  and coalesce(btrim(last_name), '') <> '';

commit;