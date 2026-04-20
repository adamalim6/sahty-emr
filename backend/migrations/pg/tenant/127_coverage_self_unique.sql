-- 127_coverage_self_unique.sql
-- Tenant migration: enforce at most one SELF member per coverage.
-- Also cleans up the known "phantom SELF" rows (empty duplicates created by a
-- previous bug in createTenantPatient when adding a dependent under an existing
-- coverage — it blindly re-inserted a SELF row with all NULL fields).

BEGIN;

-- 1. Purge obviously-phantom SELF rows:
--    not linked to a patient and with no name info = useless empty row.
DELETE FROM public.coverage_members
WHERE relationship_to_subscriber_code = 'SELF'
  AND tenant_patient_id IS NULL
  AND (member_first_name IS NULL OR member_first_name = '')
  AND (member_last_name  IS NULL OR member_last_name  = '');

-- 2. If any coverage still has multiple SELF rows after step 1, keep the
--    earliest-created one and delete the others. This is safe because a
--    duplicate SELF is always a bug — the real subscriber membership is
--    uniquely identified by (coverage_id, SELF).
DELETE FROM public.coverage_members cm
USING (
    SELECT coverage_id, MIN(created_at) AS keep_created_at
    FROM public.coverage_members
    WHERE relationship_to_subscriber_code = 'SELF'
    GROUP BY coverage_id
    HAVING COUNT(*) > 1
) dup
WHERE cm.coverage_id = dup.coverage_id
  AND cm.relationship_to_subscriber_code = 'SELF'
  AND cm.created_at <> dup.keep_created_at;

-- 3. DB-level enforcement: at most one SELF member per coverage.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coverage_members_one_self_per_coverage
    ON public.coverage_members (tenant_id, coverage_id)
    WHERE relationship_to_subscriber_code = 'SELF';

COMMIT;
