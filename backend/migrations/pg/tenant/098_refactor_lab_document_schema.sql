-- Migration: 098_refactor_lab_document_schema.sql
-- Context: public schema inside tenant database

BEGIN;

-- 1. patient_documents: Remove source_type
ALTER TABLE public.patient_documents DROP COLUMN IF EXISTS source_type;

-- 2. patient_lab_report_documents: Remove role
ALTER TABLE public.patient_lab_report_documents DROP COLUMN IF EXISTS role;

-- 3. patient_lab_report_documents: Add derivation_type
ALTER TABLE public.patient_lab_report_documents ADD COLUMN derivation_type TEXT NOT NULL DEFAULT 'ORIGINAL';

-- 4. Clean existing bad data (ensure all are ORIGINAL to start)
UPDATE public.patient_lab_report_documents SET derivation_type = 'ORIGINAL' WHERE derivation_type IS NULL OR derivation_type != 'ORIGINAL';

-- 5. Add restrictive constraints
ALTER TABLE public.patient_lab_report_documents 
  ADD CONSTRAINT check_derivation_type_enum 
  CHECK (derivation_type IN ('ORIGINAL', 'MERGED'));

ALTER TABLE public.patient_lab_report_documents 
  ADD CONSTRAINT check_sort_order_derivation 
  CHECK (
    (derivation_type = 'MERGED' AND sort_order IS NULL) OR
    (derivation_type = 'ORIGINAL')
  );

COMMIT;
