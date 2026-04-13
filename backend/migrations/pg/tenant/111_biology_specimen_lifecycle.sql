-- Migration 111: Biology Specimen Lifecycle
-- Adds status tracking and rejection metadata to lab_specimens.
-- lab_collections remains status-free (it's a header entity).

ALTER TABLE public.lab_specimens
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COLLECTED',
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT NULL;

ALTER TABLE public.lab_specimens
  DROP CONSTRAINT IF EXISTS lab_specimens_status_check;

ALTER TABLE public.lab_specimens
  ADD CONSTRAINT lab_specimens_status_check
  CHECK (status IN ('COLLECTED', 'RECEIVED', 'REJECTED', 'INSUFFICIENT'));
