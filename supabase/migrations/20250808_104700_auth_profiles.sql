-- Profiles table, RLS policies, and trigger to sync with auth.users (idempotente)
-- Ejecutar en Supabase SQL editor o vía CLI migrations

set check_function_bodies = off;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text,
  user_type text,
  first_name text,
  last_name text,
  country text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Asegurar columnas (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN user_type text;
  END IF;
END $$;

-- RLS
alter table public.profiles enable row level security;

-- Policies (idempotentes usando DO block)
DO $$ BEGIN
  BEGIN
    CREATE POLICY "Public read profiles" ON public.profiles
      FOR SELECT USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Trigger function to handle new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, user_type, first_name, last_name, country, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', NULL),
    COALESCE(NEW.raw_user_meta_data->>'user_type', NULL),
    COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    user_type = EXCLUDED.user_type,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    country = EXCLUDED.country,
    phone = EXCLUDED.phone,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Trigger on auth.users (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;
