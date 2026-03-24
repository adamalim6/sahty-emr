-- Migration: 075_update_lab_reference_interpretation_global.sql
-- Description: Update interpretation check constraint to enforce continuous interpretation tiers
-- Context: public schema representing sahty_global

BEGIN;

ALTER TABLE public.lab_reference_rules
DROP CONSTRAINT IF EXISTS lab_reference_rules_interpretation_check;

ALTER TABLE public.lab_reference_rules
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
