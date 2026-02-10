-- 007_tenants_group_membership.sql
-- Add group membership columns to tenants table

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS group_id UUID NULL REFERENCES public.groups(id) ON DELETE SET NULL;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tenancy_mode TEXT NOT NULL DEFAULT 'STANDALONE';

-- CHECK constraint: STANDALONE→no group, GROUP_MANAGED→group required
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_group_consistency CHECK (
    (tenancy_mode = 'STANDALONE' AND group_id IS NULL) OR
    (tenancy_mode = 'GROUP_MANAGED' AND group_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_tenants_group_id ON public.tenants (group_id);
