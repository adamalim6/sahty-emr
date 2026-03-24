-- Migration: 096_update_lab_reference_interpretation_tenant.sql
-- Description: Update interpretation check constraint to enforce continuous interpretation tiers
-- Context: reference schema tracking lab reference data

BEGIN;

ALTER TABLE reference.lab_reference_rules
DROP CONSTRAINT IF EXISTS lab_reference_rules_interpretation_check;

ALTER TABLE reference.lab_reference_rules
ADD CONSTRAINT lab_reference_rules_interpretation_check 
CHECK (
    interpretation IN (
        'NORMAL',
        'ABNORMAL HIGH',
        'ABNORMAL LOW',
        'CAUTION HIGH',
        'CAUTION LOW',
        'CAUTION',
        'ABNORMAL'
    )
);

COMMIT;
