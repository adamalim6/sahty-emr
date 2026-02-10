-- 010_placement_hardening.sql
-- Adds missing indexes and the "one active stay per admission" DB-level guard.

-- Performance index: rooms by service (for "beds free in this service?" queries)
CREATE INDEX IF NOT EXISTS idx_rooms_service ON rooms (service_id) WHERE is_active = true;

-- Performance index: admissions by tenant_patient (for "find patient's admissions")
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_patient ON admissions (tenant_patient_id);

-- DB-level guard: only one active stay (ended_at IS NULL) per admission
-- This is the safest way to enforce the business rule.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_stay_per_admission
    ON patient_stays (admission_id)
    WHERE ended_at IS NULL;
