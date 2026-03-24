-- 1. Create central generic documents table
DROP TABLE IF EXISTS public.patient_lab_report_documents CASCADE;
DROP TABLE IF EXISTS public.patient_documents CASCADE;

CREATE TABLE public.patient_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,

    document_type TEXT NOT NULL,
    -- allowed values for now at backend validation level:
    -- LAB_REPORT, RADIOLOGY, PRESCRIPTION, OTHER

    original_filename TEXT,
    stored_filename TEXT,
    storage_path TEXT,

    mime_type TEXT,
    file_extension TEXT,
    file_size_bytes BIGINT,

    checksum TEXT,

    source_type TEXT,
    -- UPLOAD, SCANNER, API, IMPORT

    source_system TEXT,

    extracted_text TEXT,
    ai_processed BOOLEAN NOT NULL DEFAULT false,

    uploaded_by_user_id uuid NULL,
    uploaded_at timestamptz NULL,

    actif BOOLEAN NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_documents_patient
ON public.patient_documents (tenant_patient_id);

CREATE INDEX idx_patient_documents_tenant
ON public.patient_documents (tenant_id);

CREATE INDEX idx_patient_documents_type
ON public.patient_documents (document_type);

CREATE INDEX idx_patient_documents_checksum
ON public.patient_documents (checksum);

-- 2. Refactor existing lab report linking table
DROP TABLE IF EXISTS public.patient_lab_report_documents CASCADE;

CREATE TABLE public.patient_lab_report_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_lab_report_id uuid NOT NULL,
    document_id uuid NOT NULL,

    role TEXT NOT NULL DEFAULT 'PRIMARY',
    -- PRIMARY, ATTACHMENT

    sort_order INTEGER NULL,

    actif BOOLEAN NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_lab_doc_report
        FOREIGN KEY (patient_lab_report_id)
        REFERENCES public.patient_lab_reports(id),

    CONSTRAINT fk_lab_doc_document
        FOREIGN KEY (document_id)
        REFERENCES public.patient_documents(id)
);

-- Re-point the lab extraction sessions table to the new patient_documents table
ALTER TABLE public.patient_lab_extraction_sessions 
ADD CONSTRAINT fk_extraction_document 
FOREIGN KEY (source_document_id) REFERENCES public.patient_documents(id) ON DELETE CASCADE;

CREATE INDEX idx_lab_doc_report
ON public.patient_lab_report_documents (patient_lab_report_id);

CREATE INDEX idx_lab_doc_document
ON public.patient_lab_report_documents (document_id);

CREATE UNIQUE INDEX uq_lab_report_document_link
ON public.patient_lab_report_documents (patient_lab_report_id, document_id);
