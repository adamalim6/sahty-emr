-- 005_groups.sql
-- Groups table in sahty_global

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hosting_mode TEXT NOT NULL CHECK (hosting_mode IN ('SAHTY_HOSTED', 'GROUP_HOSTED')),
  description TEXT,
  db_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_groups_name ON public.groups (name);
