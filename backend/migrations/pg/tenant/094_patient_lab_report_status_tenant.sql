-- 094_patient_lab_report_status_tenant.sql
-- Description: Adds DRAFT and VALIDATED to the patient_lab_reports status constraint.

BEGIN;

ALTER TABLE public.patient_lab_reports
DROP CONSTRAINT IF EXISTS patient_lab_reports_status_check;

ALTER TABLE public.patient_lab_reports
ADD CONSTRAINT patient_lab_reports_status_check
CHECK (status IN ('ACTIVE', 'ENTERED_IN_ERROR', 'DRAFT', 'VALIDATED'));

-- Change default to DRAFT since new reports might be partially unstructured
ALTER TABLE public.patient_lab_reports
ALTER COLUMN status SET DEFAULT 'DRAFT';

COMMIT;
