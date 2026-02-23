-- Migration: 017_create_care_categories.sql
-- Description: Create the care_categories catalog, seed it, and setup FKs on global_dci and global_products in sahty_global

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

-- 2. Seed V1 core MAR groups
INSERT INTO reference.care_categories (code, label, sort_order, is_active)
VALUES
    ('ANTIBIOTIQUES', 'Antibiotiques', 10, true),
    ('ANTIVIRAUX_ANTIFONGIQUES', 'Antiviraux / Antifongiques', 20, true),
    ('ANTALGIQUES', 'Antalgiques', 30, true),
    ('OPIOIDES', 'Opioïdes', 40, true),
    ('SEDATIFS', 'Sédatifs', 50, true),
    ('VASOACTIFS', 'Vasoactifs', 60, true),
    ('SOLUTES_ELECTROLYTES', 'Solutés / Electrolytes', 70, true),
    ('DIURETIQUES', 'Diurétiques', 80, true),
    ('ANTICOAGULANTS_ANTIAGREGANTS', 'Anticoagulants / Antiagrégants', 90, true),
    ('ANTIEPILEPTIQUES', 'Antiépileptiques', 100, true),
    ('GASTRO_PROTECTION', 'Gastro-protection', 110, true),
    ('CORTICOIDES_ANTIINFLAMMATOIRES', 'Corticoïdes / Anti-inflammatoires', 120, true),
    ('INSULINE_ANTIDIABETIQUES', 'Insuline / Antidiabétiques', 130, true),
    ('NUTRITION', 'Nutrition', 140, true),
    ('PRODUITS_SANGUINS', 'Produits sanguins', 150, true),
    ('AUTRES_SUPPORT', 'Autres (Support)', 999, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Add FK to global_dci (Molecules)
ALTER TABLE public.global_dci
ADD COLUMN IF NOT EXISTS care_category_id UUID;

ALTER TABLE public.global_dci
DROP CONSTRAINT IF EXISTS fk_global_dci_care_category;

ALTER TABLE public.global_dci
ADD CONSTRAINT fk_global_dci_care_category
FOREIGN KEY (care_category_id)
REFERENCES reference.care_categories(id);

CREATE INDEX IF NOT EXISTS idx_global_dci_care_category
ON public.global_dci (care_category_id);


-- 4. Add FK to global_products (Override Category)
ALTER TABLE public.global_products
ADD COLUMN IF NOT EXISTS care_category_id UUID;

ALTER TABLE public.global_products
DROP CONSTRAINT IF EXISTS fk_global_products_care_category;

ALTER TABLE public.global_products
ADD CONSTRAINT fk_global_products_care_category
FOREIGN KEY (care_category_id)
REFERENCES reference.care_categories(id);

CREATE INDEX IF NOT EXISTS idx_global_products_care_category
ON public.global_products (care_category_id);

COMMIT;
