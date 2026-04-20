-- 129_admission_coverages_member_fk_set_null.sql
-- Tenant migration: relax admission_coverages.coverage_member_id FK from RESTRICT to SET NULL.
--
-- Why: admission_coverages is a versioned binding with full *_snapshot columns. When a
-- patient's coverage_members row is removed (clerk edit), the admission binding's
-- snapshot data remains intact — losing the pointer is acceptable. RESTRICT was
-- blocking legitimate patient-coverage edits.
--
-- Historical bindings retain operational data via organisme_id + policy_number_snapshot +
-- member_*_snapshot + subscriber_*_snapshot. Only the convenience FK pointer goes NULL.

BEGIN;

ALTER TABLE public.admission_coverages
    DROP CONSTRAINT IF EXISTS admission_coverages_coverage_member_id_fkey;

ALTER TABLE public.admission_coverages
    ADD CONSTRAINT admission_coverages_coverage_member_id_fkey
        FOREIGN KEY (coverage_member_id)
        REFERENCES public.coverage_members(coverage_member_id)
        ON DELETE SET NULL;

COMMIT;
