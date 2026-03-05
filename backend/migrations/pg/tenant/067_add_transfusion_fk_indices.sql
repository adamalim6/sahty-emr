-- Migration 067: Add performance indices for Transfusion Tables
-- Description: Adds indices on the foreign key administration_event_id for better query performance.

CREATE INDEX IF NOT EXISTS idx_transfusion_checks_admin_event_id 
ON public.transfusion_checks (administration_event_id);

CREATE INDEX IF NOT EXISTS idx_transfusion_reactions_admin_event_id 
ON public.transfusion_reactions (administration_event_id);
