-- ============================================================
-- Migration 110: Admission Governance & ORDER_ONLY Support
-- ============================================================

-- 1. CLEANUP: Delete duplicate "En cours" admissions of the same type for the same patient
-- Keep only the NEWEST one per (tenant_patient_id, admission_type, status='En cours')
-- Must cascade through dependent tables first

-- Identify IDs to delete
CREATE TEMP TABLE _admissions_to_delete AS
SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY tenant_patient_id, admission_type
               ORDER BY admission_date DESC
           ) as rn
    FROM public.admissions
    WHERE status = 'En cours'
) ranked
WHERE rn > 1;

-- Cascade cleanup: delete from child tables first
DELETE FROM public.admission_coverage_change_history WHERE admission_id IN (SELECT id FROM _admissions_to_delete);
DELETE FROM public.admission_coverage_members WHERE admission_coverage_id IN (
    SELECT admission_coverage_id FROM public.admission_coverages WHERE admission_id IN (SELECT id FROM _admissions_to_delete)
);
DELETE FROM public.admission_coverages WHERE admission_id IN (SELECT id FROM _admissions_to_delete);
DELETE FROM public.admission_acts WHERE admission_id IN (SELECT id FROM _admissions_to_delete);

-- Free beds before deleting stays
UPDATE public.beds SET status = 'AVAILABLE' 
WHERE id IN (
    SELECT bed_id FROM public.patient_stays 
    WHERE admission_id IN (SELECT id FROM _admissions_to_delete) 
    AND ended_at IS NULL
);
DELETE FROM public.patient_stays WHERE admission_id IN (SELECT id FROM _admissions_to_delete);

-- Now safely delete the duplicate admissions
DELETE FROM public.admissions WHERE id IN (SELECT id FROM _admissions_to_delete);

DROP TABLE _admissions_to_delete;

-- 2. Add auto_close_at column for ORDER_ONLY auto-expiry
ALTER TABLE public.admissions
ADD COLUMN IF NOT EXISTS auto_close_at timestamp with time zone;

-- 3. Unique constraint: no 2 concurrent active admissions of the same type per patient
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_admission_per_type
ON public.admissions (tenant_patient_id, admission_type)
WHERE status = 'En cours';
