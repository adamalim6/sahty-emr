-- 092_lab_results_refactor_tenant.sql
-- Description: Refactors patient_lab_results and patient_lab_reports to support canonical value normalization,
-- reference-driven interpretation, and medico-legal traceability.

BEGIN;

--------------------------------------------------------------------------------
-- PHASE 1: patient_lab_results
--------------------------------------------------------------------------------

-- 1. Add context link (non-breaking)
ALTER TABLE public.patient_lab_results
ADD COLUMN IF NOT EXISTS analyte_context_id UUID NULL;

-- 2. Add canonical value (normalized result)
ALTER TABLE public.patient_lab_results
ADD COLUMN IF NOT EXISTS result_value_id UUID NULL REFERENCES reference.lab_canonical_allowed_values(id);

-- 3. Add final interpretation
ALTER TABLE public.patient_lab_results
ADD COLUMN IF NOT EXISTS interpretation TEXT NULL
CHECK (
    interpretation IN (
        'NORMAL',
        'LOW',
        'HIGH',
        'CRITICAL_LOW',
        'CRITICAL_HIGH',
        'BORDERLINE',
        'ABNORMAL'
    )
);

-- 4. Add reference traceability
ALTER TABLE public.patient_lab_results
ADD COLUMN IF NOT EXISTS reference_profile_id UUID NULL,
ADD COLUMN IF NOT EXISTS reference_rule_id UUID NULL;

-- 5. Remove redundant field
ALTER TABLE public.patient_lab_results
DROP COLUMN IF EXISTS abnormal_flag;

-- 6. Value Type Consistency (Ensure that if value_type is a specific type, its corresponding value is not null)
-- Note: This assumes that when a lab result is created, its value is provided. 
-- Adding NOT VALID first allows existing rows that might violate this to be bypassed, 
-- or we can just add it and hope there are no violations. The user didn't specify NOT VALID, so I'll add the constraint.
ALTER TABLE public.patient_lab_results
ADD CONSTRAINT chk_value_type_consistency
CHECK (
    (value_type = 'NUMERIC' AND numeric_value IS NOT NULL)
 OR (value_type = 'TEXT' AND text_value IS NOT NULL)
 OR (value_type = 'BOOLEAN' AND boolean_value IS NOT NULL)
 OR (value_type = 'CHOICE' AND choice_value IS NOT NULL)
);

--------------------------------------------------------------------------------
-- PHASE 2: patient_lab_reports
--------------------------------------------------------------------------------

-- 1. Add report-level interpretation
ALTER TABLE public.patient_lab_reports
ADD COLUMN IF NOT EXISTS interpretation_text TEXT NULL;

COMMIT;
