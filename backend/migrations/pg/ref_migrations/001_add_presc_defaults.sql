-- 001_add_presc_defaults.sql
-- Applies to TENANT databases. Updates the reference.global_products schema.

ALTER TABLE reference.global_products ADD COLUMN IF NOT EXISTS default_presc_unit TEXT;
ALTER TABLE reference.global_products ADD COLUMN IF NOT EXISTS default_presc_route TEXT;
