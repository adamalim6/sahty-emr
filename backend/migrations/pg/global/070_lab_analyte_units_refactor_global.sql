-- 070_lab_analyte_units_refactor_global.sql
-- Refactors lab_analyte_units to use deterministic numeric conversions instead of string formulas

BEGIN;

-- 1 & 2: Add columns with defaults (this inherently backfills all rows)
ALTER TABLE public.lab_analyte_units
    ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS conversion_offset NUMERIC NOT NULL DEFAULT 0;

-- 3: Drop the legacy free-text formula column safely discarding un-interpretable logic
ALTER TABLE public.lab_analyte_units
    DROP COLUMN IF EXISTS conversion_to_canonical_formula;

-- 4/5: Ensure constraints and indexes
CREATE INDEX IF NOT EXISTS idx_lab_analyte_units_analyte ON public.lab_analyte_units(analyte_id);

COMMIT;
