-- Local Chart Merge (Option B: Soft-Merge)
-- Migration ID: 026
-- Description: Adds merge pointer and merge events table to patients_tenant.
--              Supports merging duplicate local charts without rewriting clinical FKs.
--
-- Semantics:
--   ACTIVE   = live chart, visible in patient lists
--   MERGED   = redirected to another chart via merged_into_tenant_patient_id (not visible)
--   INACTIVE = archived / deceased / closed chart (not a merge, no pointer)

-- 1. Add merge pointer column
ALTER TABLE patients_tenant 
    ADD COLUMN IF NOT EXISTS merged_into_tenant_patient_id UUID 
    REFERENCES patients_tenant(tenant_patient_id);

-- 2. Partial index: fast lookup of active charts per tenant (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_patients_tenant_active 
    ON patients_tenant(tenant_id) 
    WHERE status = 'ACTIVE';

-- 3. Index on merge pointer (for reverse lookups: "what was merged into me?")
CREATE INDEX IF NOT EXISTS idx_patients_tenant_merged_into 
    ON patients_tenant(merged_into_tenant_patient_id) 
    WHERE merged_into_tenant_patient_id IS NOT NULL;

-- 4. Partial unique index: at most one ACTIVE chart per master_patient_id per tenant
-- Prevents accidental duplicates once merge workflow is in place
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_chart_per_master 
    ON patients_tenant(tenant_id, master_patient_id) 
    WHERE status = 'ACTIVE' AND master_patient_id IS NOT NULL;

-- 5. Merge events audit table
CREATE TABLE IF NOT EXISTS patient_tenant_merge_events (
    merge_event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL,
    source_tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    target_tenant_patient_id UUID NOT NULL REFERENCES patients_tenant(tenant_patient_id),
    reason                   TEXT,
    merged_by_user_id        UUID,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Source and target must be different
    CHECK (source_tenant_patient_id != target_tenant_patient_id)
);

CREATE INDEX IF NOT EXISTS idx_merge_events_tenant ON patient_tenant_merge_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_merge_events_source ON patient_tenant_merge_events(source_tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_merge_events_target ON patient_tenant_merge_events(target_tenant_patient_id);
