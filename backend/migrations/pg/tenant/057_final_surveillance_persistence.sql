-- Drop legacy columns from surveillance_hour_buckets
ALTER TABLE surveillance_hour_buckets
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS created_by_user_id,
    DROP COLUMN IF EXISTS updated_by_user_id,
    DROP COLUMN IF EXISTS revision;

-- Drop the trigger that updates updated_at, as we no longer have that column
DROP TRIGGER IF EXISTS trg_surv_hour_buckets_upd ON surveillance_hour_buckets;

-- Create the EAV logging table
CREATE TABLE IF NOT EXISTS surveillance_values_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    admission_id UUID,
    tenant_patient_id UUID NOT NULL,
    parameter_id UUID NOT NULL,
    parameter_code TEXT NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    
    -- Exactly ONE value column is non-null
    value_numeric NUMERIC,
    value_text TEXT,
    value_boolean BOOLEAN,
    
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID NOT NULL,

    -- Constraint constraints the 3 mutually-exclusive columns
    CONSTRAINT chk_exactly_one_value_type CHECK (
        (value_numeric IS NOT NULL)::int +
        (value_text IS NOT NULL)::int +
        (value_boolean IS NOT NULL)::int = 1
    ),

    -- Foreign Key constraints (assuming standard Sahty structural topology)
    CONSTRAINT fk_surv_events_parameter FOREIGN KEY (parameter_id) REFERENCES reference.observation_parameters(id) ON DELETE CASCADE
);

-- Indexes for efficient timeline reconstruction and auditing
CREATE INDEX IF NOT EXISTS idx_surv_events_tenant_patient ON surveillance_values_events(tenant_id, tenant_patient_id, bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_surv_events_tenant_admission ON surveillance_values_events(tenant_id, admission_id, bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_surv_events_parameter ON surveillance_values_events(tenant_id, parameter_id, bucket_start DESC);
