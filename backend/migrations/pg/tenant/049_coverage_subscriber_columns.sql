-- 049_coverage_subscriber_columns.sql
-- Add subscriber denormalization columns to coverages table (intentional redundancy with coverage_members)

ALTER TABLE coverages
    ADD COLUMN IF NOT EXISTS subscriber_tenant_patient_id UUID REFERENCES patients_tenant(tenant_patient_id),
    ADD COLUMN IF NOT EXISTS subscriber_first_name        TEXT,
    ADD COLUMN IF NOT EXISTS subscriber_last_name         TEXT,
    ADD COLUMN IF NOT EXISTS subscriber_identity_type     TEXT,
    ADD COLUMN IF NOT EXISTS subscriber_identity_value    TEXT,
    ADD COLUMN IF NOT EXISTS subscriber_issuing_country   TEXT;
