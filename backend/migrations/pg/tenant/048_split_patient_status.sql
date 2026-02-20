-- 048_split_patient_status.sql
-- Destructive refactor: Split overloaded 'status' into 'lifecycle_status' + 'identity_status'

-- 1. Add new columns with defaults (so existing rows get values)
ALTER TABLE patients_tenant
    ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS identity_status  TEXT NOT NULL DEFAULT 'PROVISIONAL';

-- 2. Migrate existing data
UPDATE patients_tenant SET lifecycle_status = CASE
    WHEN status = 'MERGED' THEN 'MERGED'
    WHEN status = 'INACTIVE' THEN 'INACTIVE'
    ELSE 'ACTIVE'
END;

UPDATE patients_tenant SET identity_status = CASE
    WHEN status = 'PROVISIONAL' THEN 'PROVISIONAL'
    WHEN status = 'VERIFIED' THEN 'VERIFIED'
    WHEN status = 'UNKNOWN' THEN 'UNKNOWN'
    ELSE 'PROVISIONAL'
END;

-- 3. Drop old column
ALTER TABLE patients_tenant DROP COLUMN IF EXISTS status;

-- 4. Add CHECK constraints
ALTER TABLE patients_tenant
    ADD CONSTRAINT chk_lifecycle_status CHECK (lifecycle_status IN ('ACTIVE', 'MERGED', 'INACTIVE'));
ALTER TABLE patients_tenant
    ADD CONSTRAINT chk_identity_status CHECK (identity_status IN ('UNKNOWN', 'PROVISIONAL', 'VERIFIED'));

-- 5. Recreate the unique index on new column name
DROP INDEX IF EXISTS uniq_active_chart_per_master;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_chart_per_master
    ON patients_tenant (tenant_id, master_patient_id)
    WHERE lifecycle_status = 'ACTIVE' AND master_patient_id IS NOT NULL;
