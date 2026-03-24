-- Migration: 090_lab_act_spec_volume_unit_tenant.sql
-- Description: Clean structural refactor of lab_act_specimen_types volume_unit to UUID FK
-- Context: reference schema targeting reference.units

BEGIN;

-- STEP 1: Add new standard columns (nullable initially)
ALTER TABLE reference.lab_act_specimen_types
    ADD COLUMN IF NOT EXISTS volume_unit_id UUID,
    ADD COLUMN IF NOT EXISTS volume_unit_label TEXT;

-- STEP 2: Strict UUID Foreign Key referencing tenant reference units
ALTER TABLE reference.lab_act_specimen_types
    ADD CONSTRAINT fk_lab_act_specimen_volume_unit
    FOREIGN KEY (volume_unit_id)
    REFERENCES reference.units(id)
    ON DELETE RESTRICT;

-- STEP 3: Drop the deprecated free-text legacy string 
ALTER TABLE reference.lab_act_specimen_types
    DROP COLUMN IF EXISTS volume_unit;

COMMIT;
