-- 070_remove_admission_from_surveillance.sql

-- Drop admission_id from surveillance_values_events
ALTER TABLE surveillance_values_events DROP COLUMN IF EXISTS admission_id;

-- Drop admission_id from surveillance_hour_buckets
ALTER TABLE surveillance_hour_buckets DROP COLUMN IF EXISTS admission_id;

-- Ensure indexes are strictly tenant_patient_id based now instead of relying on admission_id

-- For surveillance_values_events
DROP INDEX IF EXISTS idx_surv_events_tenant_admission;
CREATE INDEX IF NOT EXISTS idx_surv_events_tenant_patient_bucket ON surveillance_values_events(tenant_id, tenant_patient_id, bucket_start DESC);

-- For surveillance_hour_buckets
DROP INDEX IF EXISTS idx_surveillance_buckets_admission;
CREATE INDEX IF NOT EXISTS idx_surv_buckets_tenant_patient_bucket ON surveillance_hour_buckets(tenant_id, tenant_patient_id, bucket_start DESC);
