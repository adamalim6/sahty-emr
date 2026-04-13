-- Migration 112: LIMS Reception — specimen rich columns + status history table
-- Adds reception/rejection metadata columns to lab_specimens
-- Creates lab_specimen_status_history for full audit trail

-- 1. Add reception columns to lab_specimens
ALTER TABLE public.lab_specimens
ADD COLUMN IF NOT EXISTS received_at timestamp without time zone NULL,
ADD COLUMN IF NOT EXISTS received_by_user_id uuid NULL,
ADD COLUMN IF NOT EXISTS rejected_at timestamp without time zone NULL,
ADD COLUMN IF NOT EXISTS rejected_by_user_id uuid NULL,
ADD COLUMN IF NOT EXISTS last_status_changed_at timestamp without time zone NULL,
ADD COLUMN IF NOT EXISTS last_status_changed_by_user_id uuid NULL;

-- 2. Create the status history audit table
CREATE TABLE IF NOT EXISTS public.lab_specimen_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    specimen_id uuid NOT NULL,
    old_status text NULL,
    new_status text NOT NULL,
    changed_at timestamp without time zone NOT NULL DEFAULT now(),
    changed_by_user_id uuid NULL,
    reason text NULL
);

-- 3. FK to lab_specimens
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_lab_specimen_status_history_specimen'
          AND table_name = 'lab_specimen_status_history'
    ) THEN
        ALTER TABLE public.lab_specimen_status_history
        ADD CONSTRAINT fk_lab_specimen_status_history_specimen
        FOREIGN KEY (specimen_id)
        REFERENCES public.lab_specimens(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Index on specimen_id for fast history lookups
CREATE INDEX IF NOT EXISTS idx_lab_specimen_status_history_specimen_id
ON public.lab_specimen_status_history(specimen_id);
