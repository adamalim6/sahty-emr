-- 006_rename_clients_to_tenants.sql
-- Rename clients table to tenants in sahty_global

ALTER TABLE IF EXISTS public.clients RENAME TO tenants;

-- Update primary key constraint name if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_pkey') THEN
    ALTER TABLE public.tenants RENAME CONSTRAINT clients_pkey TO tenants_pkey;
  END IF;
END $$;
