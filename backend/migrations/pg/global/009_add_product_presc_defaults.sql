-- 009_add_product_presc_defaults.sql
-- Add default prescription unit and route to global_products in sahty_global

ALTER TABLE global_products ADD COLUMN IF NOT EXISTS default_presc_unit TEXT;
ALTER TABLE global_products ADD COLUMN IF NOT EXISTS default_presc_route TEXT;
