-- 010_ref_schema_changelog.sql
-- Creates the global registry for tracking available reference schema versions.

CREATE TABLE IF NOT EXISTS public.reference_schema_changelog (
  version        INTEGER PRIMARY KEY,
  description    TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed version 1 (the presc_defaults migration we are about to add)
INSERT INTO public.reference_schema_changelog (version, description)
VALUES (1, 'Add default_presc_unit and default_presc_route to reference.global_products')
ON CONFLICT (version) DO NOTHING;
