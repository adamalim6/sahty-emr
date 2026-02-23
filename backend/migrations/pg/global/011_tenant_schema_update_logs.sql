-- 011_tenant_schema_update_logs.sql
-- Creates a global log table for tracking tenant reference schema updates.

CREATE TABLE IF NOT EXISTS public.tenant_schema_update_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  from_version   INTEGER NOT NULL,
  to_version     INTEGER NOT NULL,
  status         TEXT NOT NULL,
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
