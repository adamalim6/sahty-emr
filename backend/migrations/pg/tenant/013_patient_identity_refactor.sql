-- Patient Identity Refactor
-- Migration ID: 013
-- Description: Remove nationality from patients_tenant and identity.master_patients.
--              All nationality/document info lives only in patient_documents (public)
--              and identity.master_patient_documents (identity layer) using TEXT codes.

-- 1. Drop nationality_id from patients_tenant
ALTER TABLE patients_tenant DROP COLUMN IF EXISTS nationality_id;

-- 2. Drop nationality_code from identity.master_patients
ALTER TABLE identity.master_patients DROP COLUMN IF EXISTS nationality_code;

-- 3. Add recommended index on patient_documents (issuing_country_code)
CREATE INDEX IF NOT EXISTS idx_patient_documents_country ON patient_documents (issuing_country_code);
