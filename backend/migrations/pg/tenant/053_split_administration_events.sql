-- Migration 053: Split Planned Events from Administration Actions (Epic-like model)
-- Idempotent: safe to run on both fresh and existing databases.

-- ============================================================================
-- 1. Ensure prescriptions table has correct columns (from 051/052)
-- ============================================================================
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_type TEXT NOT NULL DEFAULT 'medication';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS condition_comment TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tenant_patient_id UUID;

-- Rename 'data' to 'details' if 'data' still exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'prescriptions' AND column_name = 'data'
    ) THEN
        ALTER TABLE prescriptions RENAME COLUMN data TO details;
    END IF;
END $$;

-- Ensure details is NOT NULL and defaults to empty object
UPDATE prescriptions SET details = '{}'::jsonb WHERE details IS NULL;
ALTER TABLE prescriptions ALTER COLUMN details SET NOT NULL;
ALTER TABLE prescriptions ALTER COLUMN details SET DEFAULT '{}'::jsonb;

-- Drop deprecated columns from 052
ALTER TABLE prescriptions DROP COLUMN IF EXISTS patient_id;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS author_id;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS author_role;

-- ============================================================================
-- 2. Ensure prescription_events exists (from 051)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prescription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    admission_id UUID,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration INTEGER,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure duration column exists on pre-existing tables
ALTER TABLE prescription_events ADD COLUMN IF NOT EXISTS duration INTEGER;

CREATE INDEX IF NOT EXISTS idx_rx_events_tenant ON prescription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rx_events_prescription ON prescription_events(prescription_id);
CREATE INDEX IF NOT EXISTS idx_rx_events_status ON prescription_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_presc_events_by_admission_time ON prescription_events(tenant_id, admission_id, scheduled_at);

-- ============================================================================
-- 3. Create administration_events (NEW)
-- ============================================================================
CREATE TABLE IF NOT EXISTS administration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prescription_event_id UUID NOT NULL REFERENCES prescription_events(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    performed_by TEXT,
    performed_by_user_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_events_by_presc_event_time
    ON administration_events(tenant_id, prescription_event_id, occurred_at);

-- ============================================================================
-- 4. Migrate existing "actual" data from prescription_events → administration_events
--    Only runs if the old columns still exist.
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'prescription_events' AND column_name = 'actual_start_at'
    ) THEN
        -- Migrate rows that have actual/performed data
        INSERT INTO administration_events (
            tenant_id, prescription_event_id, action_type, occurred_at,
            actual_start_at, actual_end_at, performed_by, note
        )
        SELECT
            pe.tenant_id,
            pe.id,
            CASE
                WHEN pe.status = 'done' THEN 'completed'
                WHEN pe.status = 'skipped' THEN 'skipped'
                WHEN pe.status = 'failed' THEN 'failed'
                ELSE 'attempted'
            END,
            COALESCE(pe.performed_at, pe.actual_start_at, pe.created_at),
            pe.actual_start_at,
            pe.actual_end_at,
            pe.performed_by,
            COALESCE(pe.justification, pe.notes)
        FROM prescription_events pe
        WHERE pe.actual_start_at IS NOT NULL
           OR pe.performed_by IS NOT NULL
           OR pe.status IN ('done', 'failed', 'skipped')
        -- Avoid duplicates on re-run
        AND NOT EXISTS (
            SELECT 1 FROM administration_events ae
            WHERE ae.prescription_event_id = pe.id
        );

        RAISE NOTICE 'Migrated existing actual data to administration_events';
    END IF;
END $$;

-- ============================================================================
-- 5. Drop deprecated columns from prescription_events
-- ============================================================================
ALTER TABLE prescription_events DROP COLUMN IF EXISTS event_type;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS actual_start_at;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS actual_end_at;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS performed_by;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS performed_at;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS justification;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS notes;
ALTER TABLE prescription_events DROP COLUMN IF EXISTS updated_at;

-- Reset status to plan-only values for any migrated rows
UPDATE prescription_events
SET status = 'scheduled'
WHERE status NOT IN ('scheduled', 'cancelled', 'superseded', 'expired');

-- ============================================================================
-- 6. Audit triggers
-- ============================================================================
DROP TRIGGER IF EXISTS audit_prescriptions ON prescriptions;
CREATE TRIGGER audit_prescriptions
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();

DROP TRIGGER IF EXISTS audit_prescription_events ON prescription_events;
CREATE TRIGGER audit_prescription_events
    AFTER INSERT OR UPDATE OR DELETE ON prescription_events
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();

DROP TRIGGER IF EXISTS audit_administration_events ON administration_events;
CREATE TRIGGER audit_administration_events
    AFTER INSERT OR UPDATE OR DELETE ON administration_events
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();
