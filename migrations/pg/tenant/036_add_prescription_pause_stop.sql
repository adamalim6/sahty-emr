ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_by uuid,
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS stopped_by uuid,
  ADD COLUMN IF NOT EXISTS stopped_reason text;

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
ON public.prescriptions (tenant_id, tenant_patient_id);

CREATE INDEX IF NOT EXISTS idx_prescription_events_lookup
ON public.prescription_events (tenant_id, prescription_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_prescription_events_time
ON public.prescription_events (tenant_id, scheduled_at);
