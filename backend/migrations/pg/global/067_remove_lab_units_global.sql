-- 067_remove_lab_units_global.sql

BEGIN;

-- 1. Drop foreign keys referencing public.lab_units
ALTER TABLE public.lab_analytes DROP CONSTRAINT IF EXISTS lab_analytes_default_unit_id_fkey;
ALTER TABLE public.lab_analytes DROP CONSTRAINT IF EXISTS lab_analytes_canonical_unit_id_fkey;
ALTER TABLE public.lab_analyte_units DROP CONSTRAINT IF EXISTS lab_analyte_units_unit_id_fkey;
ALTER TABLE public.lab_analyte_reference_ranges DROP CONSTRAINT IF EXISTS lab_analyte_reference_ranges_unit_id_fkey;

-- 2. Data Migration: If we had data, we would map it here. 
-- Since this is a fresh feature, we don't expect data collision, 
-- but we write the mapping logic for safety.
-- (No complex mapping needed as tables are currently empty or seeded purely via script)

-- 3. Re-add foreign keys targeting public.units
ALTER TABLE public.lab_analytes ADD CONSTRAINT lab_analytes_default_unit_id_fkey FOREIGN KEY (default_unit_id) REFERENCES public.units(id);
ALTER TABLE public.lab_analytes ADD CONSTRAINT lab_analytes_canonical_unit_id_fkey FOREIGN KEY (canonical_unit_id) REFERENCES public.units(id);
ALTER TABLE public.lab_analyte_units ADD CONSTRAINT lab_analyte_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);
ALTER TABLE public.lab_analyte_reference_ranges ADD CONSTRAINT lab_analyte_reference_ranges_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);

-- 4. Drop the lab_units table
DROP TABLE IF EXISTS public.lab_units CASCADE;

COMMIT;
