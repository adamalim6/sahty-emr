-- migrations/pg/tenant/079_extend_surveillance_events.sql
-- Add Examen Clinique contextual columns to the surveillance EAV ledger.

ALTER TABLE public.surveillance_values_events
  ADD COLUMN observed_at TIMESTAMPTZ,
  ADD COLUMN context_id UUID,
  ADD COLUMN source_context TEXT,
  ADD COLUMN recorded_by_first_name TEXT,
  ADD COLUMN recorded_by_last_name TEXT;

-- Backfill existing Fiche de Surveillance legacy data securely
UPDATE public.surveillance_values_events
SET 
  observed_at = bucket_start,
  source_context = 'flowsheet'
WHERE source_context IS NULL;

-- Enforce NOT NULL constraints (context_id remains nullable for Fiche)
ALTER TABLE public.surveillance_values_events
  ALTER COLUMN observed_at SET NOT NULL,
  ALTER COLUMN source_context SET NOT NULL;

-- Enforce Check Constraints on source workflows
ALTER TABLE public.surveillance_values_events
  ADD CONSTRAINT chk_surveillance_source_context 
  CHECK (source_context IN ('flowsheet', 'clinical_exam'));

-- Composite tie-breaker index to efficiently pull the latest 'effective value' 
-- among identical parameters in the same Exam Context.
CREATE INDEX IF NOT EXISTS idx_surv_events_context_param_latest 
  ON public.surveillance_values_events(context_id, parameter_id, recorded_at DESC, id DESC)
  WHERE context_id IS NOT NULL AND source_context = 'clinical_exam';

-- Create an index to quickly lookup events by context
CREATE INDEX IF NOT EXISTS idx_surv_events_context_id 
  ON public.surveillance_values_events(context_id)
  WHERE context_id IS NOT NULL;
