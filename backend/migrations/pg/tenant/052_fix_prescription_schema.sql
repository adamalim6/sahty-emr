-- Migration 052: Fix Prescription Schema keys
-- Ensure we have tenant_patient_id and NOT patient_id, author_id, author_role

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tenant_patient_id UUID;

ALTER TABLE prescriptions DROP COLUMN IF EXISTS patient_id;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS author_id;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS author_role;

-- ensure prescription_events has no patient_id either just to be clean
ALTER TABLE prescription_events DROP COLUMN IF EXISTS patient_id;
