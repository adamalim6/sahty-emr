-- Migration: 061_create_care_categories.sql
-- Description: Create the care_categories catalog and setup FKs on global_dci and global_products in tenant reference schemas

BEGIN;

CREATE SCHEMA IF NOT EXISTS reference;

-- 1. Create the care_categories table
CREATE TABLE IF NOT EXISTS reference.care_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_categories_active_order
ON reference.care_categories (is_active, sort_order);

-- Note: We do not seed data here. The TenantProvisioningService handles fetching 
-- the global reference data and inserting it into the new tenant's schema.

-- 2. Add FK to global_dci (Molecules)
ALTER TABLE reference.global_dci
ADD COLUMN IF NOT EXISTS care_category_id UUID;

ALTER TABLE reference.global_dci
DROP CONSTRAINT IF EXISTS fk_global_dci_care_category;

ALTER TABLE reference.global_dci
ADD CONSTRAINT fk_global_dci_care_category
FOREIGN KEY (care_category_id)
REFERENCES reference.care_categories(id);

CREATE INDEX IF NOT EXISTS idx_global_dci_care_category
ON reference.global_dci (care_category_id);


-- 3. Add FK to global_products (Override Category)
ALTER TABLE reference.global_products
ADD COLUMN IF NOT EXISTS care_category_id UUID;

ALTER TABLE reference.global_products
DROP CONSTRAINT IF EXISTS fk_global_products_care_category;

ALTER TABLE reference.global_products
ADD CONSTRAINT fk_global_products_care_category
FOREIGN KEY (care_category_id)
REFERENCES reference.care_categories(id);

CREATE INDEX IF NOT EXISTS idx_global_products_care_category
ON reference.global_products (care_category_id);

COMMIT;
