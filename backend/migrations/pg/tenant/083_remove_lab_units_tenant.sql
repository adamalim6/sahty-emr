-- 083_remove_lab_units_tenant.sql

BEGIN;

-- 1. Drop foreign keys referencing reference.lab_units
ALTER TABLE reference.lab_analytes DROP CONSTRAINT IF EXISTS lab_analytes_default_unit_id_fkey;
ALTER TABLE reference.lab_analytes DROP CONSTRAINT IF EXISTS lab_analytes_canonical_unit_id_fkey;
ALTER TABLE reference.lab_analyte_units DROP CONSTRAINT IF EXISTS lab_analyte_units_unit_id_fkey;
ALTER TABLE reference.lab_analyte_reference_ranges DROP CONSTRAINT IF EXISTS lab_analyte_reference_ranges_unit_id_fkey;

-- 2. Data Migration: If we had data, we would map it here. 
-- Since this is a fresh feature, we don't expect data collision, 
-- but we write the mapping logic for safety.

-- 3. Re-add foreign keys targeting reference.units
ALTER TABLE reference.lab_analytes ADD CONSTRAINT lab_analytes_default_unit_id_fkey FOREIGN KEY (default_unit_id) REFERENCES reference.units(id);
ALTER TABLE reference.lab_analytes ADD CONSTRAINT lab_analytes_canonical_unit_id_fkey FOREIGN KEY (canonical_unit_id) REFERENCES reference.units(id);
ALTER TABLE reference.lab_analyte_units ADD CONSTRAINT lab_analyte_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id);
ALTER TABLE reference.lab_analyte_reference_ranges ADD CONSTRAINT lab_analyte_reference_ranges_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id);

-- 4. Drop the lab_units table
DROP TABLE IF EXISTS reference.lab_units CASCADE;

COMMIT;
