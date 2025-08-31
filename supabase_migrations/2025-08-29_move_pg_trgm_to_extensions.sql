-- Move pg_trgm extension out of public schema to extensions schema
-- Safe if already moved.
create schema if not exists extensions;
-- pg_trgm is relocatable; this moves objects to the extensions schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  END IF;
END $$;
