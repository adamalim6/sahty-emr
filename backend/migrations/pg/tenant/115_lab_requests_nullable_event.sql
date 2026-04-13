-- Migration 115: Make lab_requests.prescription_event_id nullable
-- 
-- Walk-in LIMS patients create lab_requests directly without prescriptions.
-- Only hospitalized patients (via the EMR prescription page) have prescription_events.
-- The NOT NULL + UNIQUE constraints must be relaxed for the walk-in flow.

-- 1. Drop the UNIQUE constraint (walk-in requests won't have a prescription_event_id)
ALTER TABLE public.lab_requests 
    DROP CONSTRAINT IF EXISTS unique_lab_request_per_event;

-- 2. Make the column nullable
ALTER TABLE public.lab_requests 
    ALTER COLUMN prescription_event_id DROP NOT NULL;

-- 3. Re-add unique as a partial index (only enforce uniqueness when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lab_request_per_event 
    ON public.lab_requests (prescription_event_id) 
    WHERE prescription_event_id IS NOT NULL;
