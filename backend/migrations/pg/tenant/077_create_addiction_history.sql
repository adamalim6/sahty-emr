CREATE TABLE IF NOT EXISTS public.patient_addiction_history (
    id UUID PRIMARY KEY,
    addiction_id UUID NOT NULL REFERENCES public.patient_addictions(id) ON DELETE CASCADE,
    tenant_patient_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    old_value_text TEXT,
    new_value_text TEXT,
    old_value_number NUMERIC,
    new_value_number NUMERIC,
    changed_by UUID NOT NULL,
    changed_by_first_name TEXT,
    changed_by_last_name TEXT,
    changed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_addiction_history_addiction ON public.patient_addiction_history(addiction_id);

-- Also create the requested index for observations
CREATE INDEX IF NOT EXISTS idx_observations_addiction ON public.patient_observations(linked_addiction_id);
