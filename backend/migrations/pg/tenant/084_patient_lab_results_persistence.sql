-- 084_patient_lab_results_persistence.sql
-- Description: Creates the patient domain tables for laboratory result persistence.
-- This supports document upload, grouping, atomic analyte structuring, and OCR traces.

BEGIN;

--------------------------------------------------------------------------------
-- 1. patient_lab_reports
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_lab_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_patient_id UUID NOT NULL REFERENCES public.patients_tenant(tenant_patient_id),
    admission_id UUID NULL REFERENCES public.admissions(id),

    source_type TEXT NOT NULL CHECK (source_type IN ('EXTERNAL_REPORT', 'INTERNAL_LIMS', 'EXTERNAL_INTERFACE', 'LEGACY_MIGRATION')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENTERED_IN_ERROR')),
    structuring_status TEXT NOT NULL DEFAULT 'DOCUMENT_ONLY' CHECK (structuring_status IN ('DOCUMENT_ONLY', 'STRUCTURED')),

    report_title TEXT NULL,
    source_lab_name TEXT NULL,
    source_lab_report_number TEXT NULL,

    report_date DATE NULL,
    collected_at TIMESTAMPTZ NULL,
    received_at TIMESTAMPTZ NULL,

    used_ai_assistance BOOLEAN NOT NULL DEFAULT FALSE,

    uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(user_id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    structured_by_user_id UUID NULL REFERENCES auth.users(user_id),
    structured_at TIMESTAMPTZ NULL,

    entered_in_error_by_user_id UUID NULL REFERENCES auth.users(user_id),
    entered_in_error_at TIMESTAMPTZ NULL,
    entered_in_error_reason TEXT NULL,

    notes TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_lab_reports_patient ON public.patient_lab_reports(tenant_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_reports_admission ON public.patient_lab_reports(admission_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_reports_source_type ON public.patient_lab_reports(source_type);
CREATE INDEX IF NOT EXISTS idx_patient_lab_reports_status ON public.patient_lab_reports(status);
CREATE INDEX IF NOT EXISTS idx_patient_lab_reports_report_date ON public.patient_lab_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_patient_lab_reports_uploaded_at ON public.patient_lab_reports(uploaded_at);

--------------------------------------------------------------------------------
-- 2. patient_lab_report_documents
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_lab_report_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_lab_report_id UUID NOT NULL REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE,

    original_filename TEXT NOT NULL,
    stored_filename TEXT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NULL,
    file_extension TEXT NULL,
    file_size_bytes BIGINT NULL,
    checksum TEXT NULL,

    document_role TEXT NOT NULL DEFAULT 'SOURCE' CHECK (document_role IN ('SOURCE', 'SUPPORTING', 'CORRECTED_EXPORT')),
    sort_order INTEGER NOT NULL DEFAULT 0,

    uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(user_id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_lab_report_docs_report ON public.patient_lab_report_documents(patient_lab_report_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_report_docs_user ON public.patient_lab_report_documents(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_report_docs_uploaded ON public.patient_lab_report_documents(uploaded_at);

--------------------------------------------------------------------------------
-- 3. patient_lab_report_tests
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_lab_report_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_lab_report_id UUID NOT NULL REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE,

    global_act_id UUID NULL REFERENCES reference.global_actes(id),
    panel_id UUID NULL REFERENCES reference.lab_panels(id),

    raw_test_label TEXT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_lab_report_tests_report ON public.patient_lab_report_tests(patient_lab_report_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_report_tests_global_act ON public.patient_lab_report_tests(global_act_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_report_tests_panel ON public.patient_lab_report_tests(panel_id);

--------------------------------------------------------------------------------
-- 4. patient_lab_results
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_lab_report_id UUID NOT NULL REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE,
    patient_lab_report_test_id UUID NULL REFERENCES public.patient_lab_report_tests(id) ON DELETE SET NULL,

    analyte_id UUID NULL REFERENCES reference.lab_analytes(id),
    raw_analyte_label TEXT NULL,

    value_type TEXT NOT NULL CHECK (value_type IN ('NUMERIC', 'TEXT', 'BOOLEAN', 'CHOICE')),
    numeric_value NUMERIC(18,6) NULL,
    text_value TEXT NULL,
    boolean_value BOOLEAN NULL,
    choice_value TEXT NULL,

    unit_id UUID NULL REFERENCES reference.units(id),
    raw_unit_text TEXT NULL,

    reference_range_text TEXT NULL,
    reference_low_numeric NUMERIC(18,6) NULL,
    reference_high_numeric NUMERIC(18,6) NULL,

    raw_abnormal_flag_text TEXT NULL,
    abnormal_flag TEXT NULL CHECK (abnormal_flag IN ('LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'ABNORMAL', 'NORMAL')),

    observed_at TIMESTAMPTZ NULL,
    method_id UUID NULL REFERENCES reference.lab_methods(id),
    specimen_type_id UUID NULL REFERENCES reference.lab_specimen_types(id),

    source_line_reference TEXT NULL,

    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENTERED_IN_ERROR')),
    entered_in_error_by_user_id UUID NULL REFERENCES auth.users(user_id),
    entered_in_error_at TIMESTAMPTZ NULL,
    entered_in_error_reason TEXT NULL,

    notes TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_lab_results_report ON public.patient_lab_results(patient_lab_report_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_test ON public.patient_lab_results(patient_lab_report_test_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_analyte ON public.patient_lab_results(analyte_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_unit ON public.patient_lab_results(unit_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_observed ON public.patient_lab_results(observed_at);
CREATE INDEX IF NOT EXISTS idx_patient_lab_results_status ON public.patient_lab_results(status);

--------------------------------------------------------------------------------
-- 5. patient_lab_extraction_sessions
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_lab_extraction_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_lab_report_id UUID NOT NULL REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE,
    source_document_id UUID NULL REFERENCES public.patient_lab_report_documents(id) ON DELETE CASCADE,

    engine_name TEXT NULL,
    engine_version TEXT NULL,

    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'ABANDONED')),

    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,

    raw_output_json JSONB NULL,
    notes TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_lab_extraction_report ON public.patient_lab_extraction_sessions(patient_lab_report_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_extraction_doc ON public.patient_lab_extraction_sessions(source_document_id);
CREATE INDEX IF NOT EXISTS idx_patient_lab_extraction_status ON public.patient_lab_extraction_sessions(status);
CREATE INDEX IF NOT EXISTS idx_patient_lab_extraction_started ON public.patient_lab_extraction_sessions(started_at);

COMMIT;
