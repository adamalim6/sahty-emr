-- 128_admission_coverage_versioned_binding.sql
-- Tenant migration: restructure admission_coverages into a versioned binding table.
--
-- Changes:
--   * admission_coverages gains lifecycle (binding_status, bound_at/_by, unbound_at/_by, supersedes chain)
--   * Absorbs admission_coverage_members via FK to coverage_members + denormalized member snapshots
--   * Existing descriptive columns renamed with _snapshot suffix (frozen at bind time)
--   * Partial unique indexes: 1 ACTIVE per filing_order slot + exactly 1 ACTIVE primary per admission
--     (Moroccan case B: 1 primary + N complementary concurrent)
--   * admission_coverage_members and admission_coverage_change_history dropped
--   * Dead subscriber_* columns removed from coverages (coverage_members carries subscriber identity)
--
-- Prerequisites (confirmed with user):
--   * admission_coverage_members is empty — no backfill needed
--   * admission_coverages may be wiped — fresh start
--
-- Invariants after this migration:
--   * Each admission has at most one ACTIVE row per filing_order; exactly one ACTIVE primary.
--   * REPLACED/CANCELLED rows accumulate freely for audit history.

BEGIN;

-- ============================================================
-- 0. Wipe current admission_coverages rows (FKs ON DELETE SET NULL on charge tables)
-- ============================================================
DELETE FROM public.admission_coverages;

-- ============================================================
-- 1. Rename descriptive columns to _snapshot suffix
-- ============================================================
ALTER TABLE public.admission_coverages RENAME COLUMN policy_number              TO policy_number_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN group_number               TO group_number_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN plan_name                  TO plan_name_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN coverage_type_code         TO coverage_type_code_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN subscriber_first_name      TO subscriber_first_name_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN subscriber_last_name       TO subscriber_last_name_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN subscriber_identity_type   TO subscriber_identity_type_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN subscriber_identity_value  TO subscriber_identity_value_snapshot;
ALTER TABLE public.admission_coverages RENAME COLUMN subscriber_issuing_country TO subscriber_issuing_country_snapshot;

-- ============================================================
-- 2. Add new columns: lifecycle, member FK + snapshots, organisme name snapshot, updated_at
-- ============================================================
ALTER TABLE public.admission_coverages
    ADD COLUMN organisme_name_snapshot                  TEXT,
    ADD COLUMN coverage_member_id                       UUID NULL
        REFERENCES public.coverage_members(coverage_member_id) ON DELETE RESTRICT,
    ADD COLUMN member_first_name_snapshot               TEXT,
    ADD COLUMN member_last_name_snapshot                TEXT,
    ADD COLUMN relationship_to_subscriber_code_snapshot TEXT,
    ADD COLUMN member_identity_type_snapshot            TEXT,
    ADD COLUMN member_identity_value_snapshot           TEXT,
    ADD COLUMN member_issuing_country_snapshot          TEXT,
    ADD COLUMN binding_status                           TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (binding_status IN ('ACTIVE', 'REPLACED', 'CANCELLED')),
    ADD COLUMN bound_at                                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN bound_by_user_id                         UUID NULL,
    ADD COLUMN unbound_at                               TIMESTAMPTZ NULL,
    ADD COLUMN unbound_by_user_id                       UUID NULL,
    ADD COLUMN unbind_reason                            TEXT NULL,
    ADD COLUMN supersedes_admission_coverage_id         UUID NULL
        REFERENCES public.admission_coverages(admission_coverage_id) ON DELETE SET NULL,
    ADD COLUMN updated_at                               TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- 3. Filing_order constraint (case B: 1 primary + N complementary, no upper bound)
-- ============================================================
ALTER TABLE public.admission_coverages
    ADD CONSTRAINT chk_admission_coverages_filing_order CHECK (filing_order >= 1);

-- ============================================================
-- 4. Replace unconditional unique with partial uniques (DB-level enforcement of case B)
-- ============================================================
DROP INDEX IF EXISTS public.idx_adm_cov_order;

CREATE UNIQUE INDEX uq_adm_cov_active_filing_order
    ON public.admission_coverages (tenant_id, admission_id, filing_order)
    WHERE binding_status = 'ACTIVE';

CREATE UNIQUE INDEX uq_adm_cov_active_primary
    ON public.admission_coverages (tenant_id, admission_id)
    WHERE binding_status = 'ACTIVE' AND filing_order = 1;

CREATE INDEX idx_adm_cov_status             ON public.admission_coverages (binding_status);
CREATE INDEX idx_adm_cov_coverage_member    ON public.admission_coverages (coverage_member_id);
CREATE INDEX idx_adm_cov_supersedes         ON public.admission_coverages (supersedes_admission_coverage_id);

CREATE TRIGGER trg_admission_coverages_updated_at
    BEFORE UPDATE ON public.admission_coverages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Drop orphan column on admission_charge_snapshots (its target table is going away)
-- ============================================================
ALTER TABLE public.admission_charge_snapshots
    DROP COLUMN IF EXISTS admission_coverage_member_id;

-- ============================================================
-- 6. Drop deprecated sibling tables
-- ============================================================
DROP TABLE IF EXISTS public.admission_coverage_members;
DROP TABLE IF EXISTS public.admission_coverage_change_history;

-- ============================================================
-- 7. Remove dead subscriber columns on patient-level coverages
--    (coverage_members with relationship='SELF' is the source of truth for subscriber identity)
-- ============================================================
ALTER TABLE public.coverages
    DROP COLUMN IF EXISTS subscriber_first_name,
    DROP COLUMN IF EXISTS subscriber_last_name,
    DROP COLUMN IF EXISTS subscriber_identity_type,
    DROP COLUMN IF EXISTS subscriber_identity_value,
    DROP COLUMN IF EXISTS subscriber_issuing_country;

COMMIT;
