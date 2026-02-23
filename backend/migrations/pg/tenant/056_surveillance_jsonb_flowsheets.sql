-- Migration 056: Fiche de Surveillance Architecture (JSONB Buckets + Flowsheets)

-- 1. Catalog tables are now stored in sahty_global.public and mirrored via referenceSync

-- 2. JSONB Hour Buckets Table

-- 2. JSONB Hour Buckets Table
CREATE TABLE IF NOT EXISTS surveillance_hour_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    admission_id UUID, -- Can be null, as MAR flowsheet is patient-centric
    tenant_patient_id UUID NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    values JSONB NOT NULL DEFAULT '{}'::jsonb,
    revision INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id UUID,
    UNIQUE (tenant_id, tenant_patient_id, bucket_start)
);

-- Indexes for fast timeline queries
CREATE INDEX IF NOT EXISTS idx_surveillance_buckets_patient ON surveillance_hour_buckets(tenant_id, tenant_patient_id, bucket_start);
CREATE INDEX IF NOT EXISTS idx_surveillance_buckets_admission ON surveillance_hour_buckets(tenant_id, admission_id, bucket_start);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_surv_hour_buckets_upd ON surveillance_hour_buckets;
CREATE TRIGGER trg_surv_hour_buckets_upd
    BEFORE UPDATE ON surveillance_hour_buckets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Observation catalog tables moved to global, triggers removed here
