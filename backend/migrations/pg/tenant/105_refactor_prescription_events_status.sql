-- Migration 105: Refactor prescription_events status constraints
-- As per user consent, this environment sweeps existing schedule logic and
-- restructures the prescription_events.status exclusively to tracking 
-- overridden intents (ACTIVE, SKIPPED).

-- 1. Wipe exiting prototype data safely 
DELETE FROM prescriptions; -- Cascades to prescription_events, administration_events

-- 2. Structure Status Constraint securely
ALTER TABLE prescription_events ALTER COLUMN status DROP DEFAULT;
ALTER TABLE prescription_events ADD CONSTRAINT prescription_events_status_check CHECK (status IN ('ACTIVE', 'SKIPPED'));
ALTER TABLE prescription_events ALTER COLUMN status SET DEFAULT 'ACTIVE';
