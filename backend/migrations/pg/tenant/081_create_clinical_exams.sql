-- migrations/pg/tenant/080_create_clinical_exams.sql
-- Create the Header table containing Context Identifiers and Status/Error tracing for Examen Clinique

CREATE TABLE IF NOT EXISTS public.clinical_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tenant_patient_id UUID NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    
    -- Creation Lineage
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID NOT NULL,
    recorded_by_first_name TEXT,
    recorded_by_last_name TEXT,

    -- Amendment Lineage (for tracking same-header updates)
    last_amended_at TIMESTAMPTZ,
    last_amended_by UUID,
    last_amended_by_first_name TEXT,
    last_amended_by_last_name TEXT,

    -- Status & Error Flow
    status TEXT NOT NULL DEFAULT 'active',
    entered_in_error_at TIMESTAMPTZ,
    entered_in_error_by UUID,
    entered_in_error_by_first_name TEXT,
    entered_in_error_by_last_name TEXT,
    entered_in_error_reason TEXT,

    -- Constraints
    CONSTRAINT chk_clinical_exams_status CHECK (status IN ('active', 'entered_in_error')),
    
    -- Relationships
    CONSTRAINT fk_clinical_exams_patient FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE
);

-- Index for retrieving patient exams chronologically without errors
CREATE INDEX IF NOT EXISTS idx_clinical_exams_patient_status_date 
    ON public.clinical_exams(tenant_patient_id, status, observed_at DESC);
