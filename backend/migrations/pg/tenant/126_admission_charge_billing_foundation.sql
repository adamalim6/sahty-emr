-- 126_admission_charge_billing_foundation.sql
-- Tenant migration: Billing/charge-router foundation for Admission Actes
--
-- Introduces the SPLIT model:
--   admission_charge_events    — stable identity + lifecycle of a charge captured from an admission act
--   admission_charge_snapshots — immutable pricing/commercial state over time for a charge event
--   admission_charge_dispatches — editable working dispatch rows (fixed MAD amounts) per snapshot
--   billing_postings           — final ledger entries (posted later; table only in this ticket)
--   billing_posting_dispatches — final locked dispatch rows per posting
--
-- Also adds: pricing_lists.is_default flag + partial unique index guaranteeing at most
-- one PUBLISHED default grid at any time. This is the fallback grid used when coverage
-- does not resolve to a pricing list.

BEGIN;

-- ============================================================
-- 0. Default pricing list flag (fallback grid support)
-- ============================================================
ALTER TABLE public.pricing_lists
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_lists_one_default_published
    ON public.pricing_lists (is_default)
    WHERE is_default = TRUE AND status = 'PUBLISHED';


-- ============================================================
-- 1. admission_charge_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admission_charge_events (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id                UUID NOT NULL
                                    REFERENCES public.admissions(id) ON DELETE RESTRICT,
    admission_act_id            UUID NOT NULL
                                    REFERENCES public.admission_acts(id) ON DELETE RESTRICT,
    patient_id                  UUID NOT NULL,
    global_act_id               UUID NOT NULL
                                    REFERENCES reference.global_actes(id) ON DELETE RESTRICT,
    source_type                 TEXT NOT NULL DEFAULT 'ADMISSION_ACT'
                                    CHECK (source_type IN ('ADMISSION_ACT')),
    quantity                    NUMERIC(12,3) NOT NULL DEFAULT 1
                                    CHECK (quantity > 0),
    currency_code               TEXT NOT NULL DEFAULT 'MAD',

    status                      TEXT NOT NULL DEFAULT 'CAPTURED'
                                    CHECK (status IN ('CAPTURED', 'PENDING_REVIEW', 'READY_TO_POST', 'VOIDED_BEFORE_POSTING', 'POSTED')),
    pricing_status              TEXT NOT NULL
                                    CHECK (pricing_status IN ('RESOLVED', 'PROVISIONAL', 'MANUAL_OVERRIDE', 'REPRICE_RECOMMENDED', 'PENDING_REVIEW')),
    pricing_lock_status         TEXT NOT NULL DEFAULT 'AUTO'
                                    CHECK (pricing_lock_status IN ('AUTO', 'MANUAL_LOCK')),

    coverage_resolution_mode    TEXT NOT NULL
                                    CHECK (coverage_resolution_mode IN ('COVERAGE_MATCHED', 'FALLBACK_DEFAULT', 'MANUAL', 'NONE')),
    coverage_resolution_reason  TEXT NULL,

    admission_coverage_id       UUID NULL
                                    REFERENCES public.admission_coverages(admission_coverage_id) ON DELETE SET NULL,

    current_snapshot_id         UUID NULL,  -- FK added at bottom of migration (circular w/ snapshots)

    captured_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_by_user_id         UUID NULL,
    voided_at                   TIMESTAMPTZ NULL,
    voided_by_user_id           UUID NULL,
    void_reason                 TEXT NULL,
    posted_at                   TIMESTAMPTZ NULL,
    posted_by_user_id           UUID NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_charge_event_admission_act UNIQUE (admission_act_id)
);

CREATE INDEX IF NOT EXISTS idx_charge_events_admission ON public.admission_charge_events (admission_id);
CREATE INDEX IF NOT EXISTS idx_charge_events_patient ON public.admission_charge_events (patient_id);
CREATE INDEX IF NOT EXISTS idx_charge_events_global_act ON public.admission_charge_events (global_act_id);
CREATE INDEX IF NOT EXISTS idx_charge_events_status ON public.admission_charge_events (status);
CREATE INDEX IF NOT EXISTS idx_charge_events_pricing_status ON public.admission_charge_events (pricing_status);
CREATE INDEX IF NOT EXISTS idx_charge_events_coverage ON public.admission_charge_events (admission_coverage_id);
CREATE INDEX IF NOT EXISTS idx_charge_events_admission_active
    ON public.admission_charge_events (admission_id)
    WHERE status IN ('CAPTURED', 'PENDING_REVIEW', 'READY_TO_POST');

CREATE TRIGGER trg_charge_events_updated_at
    BEFORE UPDATE ON public.admission_charge_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 2. admission_charge_snapshots  (immutable — no updated_at)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admission_charge_snapshots (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_charge_event_id       UUID NOT NULL
                                        REFERENCES public.admission_charge_events(id) ON DELETE CASCADE,
    snapshot_no                     INTEGER NOT NULL,
    is_current                      BOOLEAN NOT NULL DEFAULT FALSE,
    supersedes_snapshot_id          UUID NULL
                                        REFERENCES public.admission_charge_snapshots(id) ON DELETE SET NULL,

    quantity                        NUMERIC(12,3) NOT NULL DEFAULT 1
                                        CHECK (quantity > 0),
    unit_price_snapshot             NUMERIC(12,2) NOT NULL DEFAULT 0
                                        CHECK (unit_price_snapshot >= 0),
    total_price_snapshot            NUMERIC(14,2) NOT NULL DEFAULT 0
                                        CHECK (total_price_snapshot >= 0),
    currency_code                   TEXT NOT NULL DEFAULT 'MAD',

    pricing_source_type             TEXT NOT NULL
                                        CHECK (pricing_source_type IN ('PRICING_LIST', 'MANUAL', 'NONE')),
    snapshot_source                 TEXT NOT NULL
                                        CHECK (snapshot_source IN ('INITIAL_CAPTURE', 'AUTO_REPRICE', 'MANUAL_REPRICE', 'PROVISIONAL_NO_ITEM', 'PENDING_REVIEW_NO_CONFIG')),

    pricing_list_id                 UUID NULL
                                        REFERENCES public.pricing_lists(id) ON DELETE RESTRICT,
    pricing_list_code               TEXT NULL,
    pricing_list_version_no         INTEGER NULL,
    pricing_list_item_id            UUID NULL
                                        REFERENCES public.pricing_list_items(id) ON DELETE RESTRICT,
    pricing_list_item_version_id    UUID NULL
                                        REFERENCES public.pricing_list_item_versions(id) ON DELETE RESTRICT,
    pricing_list_item_version_no    INTEGER NULL,
    billing_label                   TEXT NULL,

    organisme_id                    UUID NULL
                                        REFERENCES reference.organismes(id) ON DELETE RESTRICT,
    admission_coverage_id           UUID NULL
                                        REFERENCES public.admission_coverages(admission_coverage_id) ON DELETE SET NULL,
    admission_coverage_member_id    UUID NULL
                                        REFERENCES public.admission_coverage_members(admission_coverage_member_id) ON DELETE SET NULL,
    coverage_resolution_mode        TEXT NULL
                                        CHECK (coverage_resolution_mode IN ('COVERAGE_MATCHED', 'FALLBACK_DEFAULT', 'MANUAL', 'NONE')),
    coverage_resolution_reason      TEXT NULL,

    vat_rate_snapshot               NUMERIC(5,2) NULL,
    repricing_reason                TEXT NULL,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id              UUID NULL,

    CONSTRAINT uq_charge_snapshot_event_no UNIQUE (admission_charge_event_id, snapshot_no)
);

-- Only one is_current=TRUE per event
CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_snapshots_one_current
    ON public.admission_charge_snapshots (admission_charge_event_id)
    WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_charge_snapshots_event ON public.admission_charge_snapshots (admission_charge_event_id);
CREATE INDEX IF NOT EXISTS idx_charge_snapshots_is_current ON public.admission_charge_snapshots (is_current);
CREATE INDEX IF NOT EXISTS idx_charge_snapshots_item_version ON public.admission_charge_snapshots (pricing_list_item_version_id);
CREATE INDEX IF NOT EXISTS idx_charge_snapshots_source ON public.admission_charge_snapshots (snapshot_source);
CREATE INDEX IF NOT EXISTS idx_charge_snapshots_created_at ON public.admission_charge_snapshots (created_at DESC);


-- ============================================================
-- 3. admission_charge_dispatches  (editable, fixed MAD amounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admission_charge_dispatches (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_charge_snapshot_id    UUID NOT NULL
                                        REFERENCES public.admission_charge_snapshots(id) ON DELETE CASCADE,
    dispatch_type                   TEXT NOT NULL
                                        CHECK (dispatch_type IN ('PART_MEDECIN_1', 'PART_MEDECIN_2', 'PART_CLINIQUE_BLOC', 'PART_PHARMACIE', 'PART_LABO', 'PART_RADIOLOGIE', 'PART_SEJOUR')),
    sequence_no                     INTEGER NOT NULL DEFAULT 1,
    amount                          NUMERIC(12,2) NOT NULL
                                        CHECK (amount >= 0),
    currency_code                   TEXT NOT NULL DEFAULT 'MAD',
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_charge_dispatch_type UNIQUE (admission_charge_snapshot_id, dispatch_type)
);

CREATE INDEX IF NOT EXISTS idx_charge_dispatches_snapshot ON public.admission_charge_dispatches (admission_charge_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_charge_dispatches_type ON public.admission_charge_dispatches (dispatch_type);

CREATE TRIGGER trg_charge_dispatches_updated_at
    BEFORE UPDATE ON public.admission_charge_dispatches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 4. billing_postings  (final ledger — scaffold only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_postings (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id                    UUID NOT NULL
                                        REFERENCES public.admissions(id) ON DELETE RESTRICT,
    patient_id                      UUID NOT NULL,
    admission_charge_event_id       UUID NOT NULL
                                        REFERENCES public.admission_charge_events(id) ON DELETE RESTRICT,
    admission_charge_snapshot_id    UUID NOT NULL
                                        REFERENCES public.admission_charge_snapshots(id) ON DELETE RESTRICT,

    posting_type                    TEXT NOT NULL
                                        CHECK (posting_type IN ('DEBIT', 'CREDIT', 'ADJUSTMENT')),
    document_type                   TEXT NULL
                                        CHECK (document_type IN ('INVOICE', 'CREDIT_NOTE', 'MANUAL_ADJUSTMENT')),
    document_id                     UUID NULL,

    quantity                        NUMERIC(12,3) NOT NULL DEFAULT 1
                                        CHECK (quantity > 0),
    unit_amount                     NUMERIC(12,2) NOT NULL
                                        CHECK (unit_amount >= 0),
    total_amount                    NUMERIC(14,2) NOT NULL
                                        CHECK (total_amount >= 0),
    currency_code                   TEXT NOT NULL DEFAULT 'MAD',

    posted_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_by_user_id               UUID NULL,
    reverses_posting_id             UUID NULL
                                        REFERENCES public.billing_postings(id) ON DELETE RESTRICT,
    notes                           TEXT NULL,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_postings_admission ON public.billing_postings (admission_id);
CREATE INDEX IF NOT EXISTS idx_billing_postings_patient ON public.billing_postings (patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_postings_event ON public.billing_postings (admission_charge_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_postings_posted_at ON public.billing_postings (posted_at);


-- ============================================================
-- 5. billing_posting_dispatches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_posting_dispatches (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_posting_id              UUID NOT NULL
                                        REFERENCES public.billing_postings(id) ON DELETE CASCADE,
    dispatch_type                   TEXT NOT NULL
                                        CHECK (dispatch_type IN ('PART_MEDECIN_1', 'PART_MEDECIN_2', 'PART_CLINIQUE_BLOC', 'PART_PHARMACIE', 'PART_LABO', 'PART_RADIOLOGIE', 'PART_SEJOUR')),
    sequence_no                     INTEGER NOT NULL DEFAULT 1,
    amount                          NUMERIC(12,2) NOT NULL
                                        CHECK (amount >= 0),
    currency_code                   TEXT NOT NULL DEFAULT 'MAD',
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_posting_dispatch_type UNIQUE (billing_posting_id, dispatch_type)
);

CREATE INDEX IF NOT EXISTS idx_billing_posting_dispatches_posting ON public.billing_posting_dispatches (billing_posting_id);


-- ============================================================
-- 6. Circular FK: admission_charge_events.current_snapshot_id
-- ============================================================
-- Handled at the bottom: both tables now exist, so we can wire the denormalized
-- "current snapshot" pointer with a real FK. Service inserts event with NULL first,
-- then snapshot, then UPDATEs — so no deferred constraint needed.
ALTER TABLE public.admission_charge_events
    ADD CONSTRAINT fk_charge_events_current_snapshot
    FOREIGN KEY (current_snapshot_id)
    REFERENCES public.admission_charge_snapshots(id)
    ON DELETE SET NULL;

COMMIT;
