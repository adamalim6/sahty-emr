-- 1. Add new columns to patient_lab_results
ALTER TABLE public.patient_lab_results 
ADD COLUMN lab_analyte_context_id UUID NULL,
ADD COLUMN raw_method_text TEXT NULL,
ADD COLUMN raw_specimen_type_text TEXT NULL;

-- 2. Create index on the new context ID
CREATE INDEX idx_patient_lab_results_analyte_ctx ON public.patient_lab_results(lab_analyte_context_id);

-- 3. Add safety constraint (Either it maps to a catalog, or it has a raw string)
ALTER TABLE public.patient_lab_results 
ADD CONSTRAINT chk_patient_lab_results_identity 
CHECK (lab_analyte_context_id IS NOT NULL OR raw_analyte_label IS NOT NULL);

-- 4. Update the patient_lab_reports.status check constraint to include 'AMENDED'
DO $$ 
DECLARE 
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'patient_lab_reports' 
      AND a.attname = 'status'
      AND c.contype = 'c';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.patient_lab_reports DROP CONSTRAINT ' || constraint_name;
    END IF;
    
    ALTER TABLE public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_status_check
    CHECK (status IN ('ACTIVE', 'ENTERED_IN_ERROR', 'DRAFT', 'VALIDATED', 'AMENDED'));
END $$;
