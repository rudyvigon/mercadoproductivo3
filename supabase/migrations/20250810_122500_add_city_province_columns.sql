BEGIN;

-- Asegurar columnas requeridas por el frontend
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postal_code text;

COMMENT ON COLUMN public.profiles.city IS 'Localidad del usuario';
COMMENT ON COLUMN public.profiles.province IS 'Provincia del usuario';
COMMENT ON COLUMN public.profiles.address IS 'Dirección del usuario';
COMMENT ON COLUMN public.profiles.postal_code IS 'Código Postal del usuario';

COMMIT;
