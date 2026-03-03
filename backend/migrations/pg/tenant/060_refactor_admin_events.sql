-- Migration 060: Refactor Administration Events for Modal Revamp
-- Adds cancellation and non-recursive linking capabilities

-- 1. Add Status
ALTER TABLE administration_events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

-- 2. Add Cancellation Reason
ALTER TABLE administration_events
ADD COLUMN IF NOT EXISTS cancellation_reason text NULL;

-- 3. Add Flat Grouping ID (named linked_event_id but acting as a group identifier without self-referential FK constraints)
ALTER TABLE administration_events
ADD COLUMN IF NOT EXISTS linked_event_id uuid NULL;

-- 4. Constraint for Status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'administration_events_status_check'
    ) THEN
        ALTER TABLE administration_events
        ADD CONSTRAINT administration_events_status_check
        CHECK (status IN ('ACTIVE', 'CANCELLED'));
    END IF;
END $$;
