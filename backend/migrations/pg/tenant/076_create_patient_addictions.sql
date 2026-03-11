CREATE TABLE IF NOT EXISTS public.patient_addictions (
    id UUID PRIMARY KEY,
    tenant_patient_id UUID NOT NULL,
    addiction_type TEXT NOT NULL,
    substance_label TEXT,
    qty NUMERIC,
    unit TEXT,
    frequency TEXT,
    status TEXT NOT NULL,
    stop_motivation_score NUMERIC,
    start_date DATE,
    last_use_date DATE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_addiction_patient ON public.patient_addictions(tenant_patient_id);
