
-- 1. Refactor patients_tenant
ALTER TABLE public.patients_tenant
ADD COLUMN IF NOT EXISTS master_patient_id UUID REFERENCES identity.master_patients(id),
ADD COLUMN IF NOT EXISTS mpi_link_status TEXT NOT NULL DEFAULT 'UNLINKED',
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS sex TEXT;

CREATE INDEX IF NOT EXISTS idx_patient_tenant_master_patient_id ON public.patients_tenant(master_patient_id);

-- 2. Expand patient_addresses
ALTER TABLE public.patient_addresses
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create patient_documents (Local)
CREATE TABLE IF NOT EXISTS public.patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE,
    document_type_code TEXT NOT NULL, -- No FK to identity.document_types forced, keeps it loose? Or should we? Let's keep it loose for local flexibility, but valid codes preferred.
    document_number TEXT NOT NULL,
    issuing_country_code TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_lookup ON public.patient_documents(document_type_code, document_number);
