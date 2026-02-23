-- Migration 051: Refactor Prescriptions for PostgreSQL Storage
-- Replaces JSON file storage with fully functional PostgreSQL tables

-- 1. Refactor 'prescriptions' header table
ALTER TABLE prescriptions 
  ADD COLUMN IF NOT EXISTS prescription_type text NOT NULL DEFAULT 'medication',
  ADD COLUMN IF NOT EXISTS condition_comment text,
  ADD COLUMN IF NOT EXISTS author_id uuid,
  ADD COLUMN IF NOT EXISTS author_role text;

-- Rename 'data' to 'details' 
ALTER TABLE prescriptions RENAME COLUMN data TO details;

-- Ensure details is NOT NULL and defaults to empty object
UPDATE prescriptions SET details = '{}'::jsonb WHERE details IS NULL;
ALTER TABLE prescriptions ALTER COLUMN details SET NOT NULL;
ALTER TABLE prescriptions ALTER COLUMN details SET DEFAULT '{}'::jsonb;

-- 2. Create prescription_events table (MAR source of truth)
CREATE TABLE IF NOT EXISTS prescription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    admission_id UUID,

    scheduled_at TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL, -- scheduled, administered, skipped, cancelled, etc.
    status TEXT NOT NULL DEFAULT 'planned',

    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,

    performed_by TEXT,
    performed_at TIMESTAMPTZ,

    justification TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_events_tenant ON prescription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rx_events_prescription ON prescription_events(prescription_id);
CREATE INDEX IF NOT EXISTS idx_rx_events_status ON prescription_events(tenant_id, status);

-- 3. Add to generic audit log
DROP TRIGGER IF EXISTS audit_prescriptions ON prescriptions;
CREATE TRIGGER audit_prescriptions 
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions 
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();

DROP TRIGGER IF EXISTS audit_prescription_events ON prescription_events;
CREATE TRIGGER audit_prescription_events 
    AFTER INSERT OR UPDATE OR DELETE ON prescription_events 
    FOR EACH ROW EXECUTE FUNCTION fn_generic_audit();
