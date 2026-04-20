-- 125_pricing_list_foundation.sql
-- Tenant migration: Pricing list model for billing / charge-router layer
--
-- Tables:
--   1. pricing_lists                          — Header / master record
--   2. pricing_list_organismes                — Organisme assignment to pricing lists
--   3. pricing_list_items                     — Stable membership: global_act in pricing list
--   4. pricing_list_item_versions             — Row-versioned price/dispatch/commercial state
--   5. pricing_list_item_version_dispatches   — Dispatch rows per item version

BEGIN;

-- ============================================================
-- 1. pricing_lists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_lists (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                        TEXT NOT NULL,
    name                        TEXT NOT NULL,
    description                 TEXT NULL,
    version_no                  INTEGER NOT NULL DEFAULT 1,
    status                      TEXT NOT NULL DEFAULT 'DRAFT'
                                    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    supersedes_pricing_list_id  UUID NULL
                                    REFERENCES public.pricing_lists(id) ON DELETE SET NULL,
    currency_code               TEXT NOT NULL DEFAULT 'MAD',
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from                  DATE NULL,
    valid_to                    DATE NULL,
    change_reason               TEXT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID NULL,
    published_at                TIMESTAMPTZ NULL,
    published_by_user_id        UUID NULL,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pricing_lists_code_version UNIQUE (code, version_no),
    CONSTRAINT chk_pricing_lists_validity CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

CREATE INDEX IF NOT EXISTS idx_pricing_lists_status ON public.pricing_lists (status);
CREATE INDEX IF NOT EXISTS idx_pricing_lists_validity ON public.pricing_lists (valid_from, valid_to);

CREATE TRIGGER trg_pricing_lists_updated_at
    BEFORE UPDATE ON public.pricing_lists
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 2. pricing_list_organismes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_list_organismes (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_list_id             UUID NOT NULL
                                    REFERENCES public.pricing_lists(id) ON DELETE CASCADE,
    organisme_id                UUID NOT NULL
                                    REFERENCES reference.organismes(id) ON DELETE RESTRICT,
    assignment_status           TEXT NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (assignment_status IN ('ACTIVE', 'REMOVED')),
    valid_from                  DATE NULL,
    valid_to                    DATE NULL,
    assigned_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_user_id         UUID NULL,
    removed_at                  TIMESTAMPTZ NULL,
    removed_by_user_id          UUID NULL,
    removal_reason              TEXT NULL,
    change_reason               TEXT NULL,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pricing_list_organismes UNIQUE (pricing_list_id, organisme_id),
    CONSTRAINT chk_pricing_list_organismes_validity CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

CREATE INDEX IF NOT EXISTS idx_pricing_list_organismes_pricing_list ON public.pricing_list_organismes (pricing_list_id);
CREATE INDEX IF NOT EXISTS idx_pricing_list_organismes_organisme ON public.pricing_list_organismes (organisme_id);
CREATE INDEX IF NOT EXISTS idx_pricing_list_organismes_status ON public.pricing_list_organismes (assignment_status);

CREATE TRIGGER trg_pricing_list_organismes_updated_at
    BEFORE UPDATE ON public.pricing_list_organismes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 3. pricing_list_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_list_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_list_id             UUID NOT NULL
                                    REFERENCES public.pricing_lists(id) ON DELETE CASCADE,
    global_act_id               UUID NOT NULL
                                    REFERENCES reference.global_actes(id) ON DELETE RESTRICT,
    membership_status           TEXT NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (membership_status IN ('ACTIVE', 'REMOVED')),
    added_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by_user_id            UUID NULL,
    removed_at                  TIMESTAMPTZ NULL,
    removed_by_user_id          UUID NULL,
    removal_reason              TEXT NULL,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pricing_list_items UNIQUE (pricing_list_id, global_act_id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_list_items_pricing_list ON public.pricing_list_items (pricing_list_id);
CREATE INDEX IF NOT EXISTS idx_pricing_list_items_global_act ON public.pricing_list_items (global_act_id);
CREATE INDEX IF NOT EXISTS idx_pricing_list_items_status ON public.pricing_list_items (membership_status);

CREATE TRIGGER trg_pricing_list_items_updated_at
    BEFORE UPDATE ON public.pricing_list_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 4. pricing_list_item_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_list_item_versions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_list_item_id        UUID NOT NULL
                                    REFERENCES public.pricing_list_items(id) ON DELETE CASCADE,
    version_no                  INTEGER NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'DRAFT'
                                    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    supersedes_version_id       UUID NULL
                                    REFERENCES public.pricing_list_item_versions(id) ON DELETE SET NULL,
    unit_price                  NUMERIC(12,2) NOT NULL
                                    CHECK (unit_price >= 0),
    billing_label               TEXT NULL,
    valid_from                  DATE NULL,
    valid_to                    DATE NULL,
    change_reason               TEXT NULL,
    change_type                 TEXT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID NULL,
    published_at                TIMESTAMPTZ NULL,
    published_by_user_id        UUID NULL,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pricing_list_item_versions UNIQUE (pricing_list_item_id, version_no),
    CONSTRAINT chk_pricing_list_item_versions_validity CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

CREATE INDEX IF NOT EXISTS idx_pliv_item ON public.pricing_list_item_versions (pricing_list_item_id);
CREATE INDEX IF NOT EXISTS idx_pliv_status ON public.pricing_list_item_versions (status);
CREATE INDEX IF NOT EXISTS idx_pliv_validity ON public.pricing_list_item_versions (valid_from, valid_to);

CREATE TRIGGER trg_pricing_list_item_versions_updated_at
    BEFORE UPDATE ON public.pricing_list_item_versions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 5. pricing_list_item_version_dispatches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_list_item_version_dispatches (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_list_item_version_id    UUID NOT NULL
                                        REFERENCES public.pricing_list_item_versions(id) ON DELETE CASCADE,
    dispatch_type                   TEXT NOT NULL
                                        CHECK (dispatch_type IN ('PART_MEDECIN_1', 'PART_MEDECIN_2', 'PART_CLINIQUE_BLOC', 'PART_PHARMACIE', 'PART_LABO', 'PART_RADIOLOGIE', 'PART_SEJOUR')),
    sequence_no                     INTEGER NOT NULL DEFAULT 1,
    allocation_value                NUMERIC(12,2) NOT NULL
                                        CHECK (allocation_value >= 0),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_plivd_version_dispatch_type UNIQUE (pricing_list_item_version_id, dispatch_type)
);

CREATE INDEX IF NOT EXISTS idx_plivd_version ON public.pricing_list_item_version_dispatches (pricing_list_item_version_id);

CREATE TRIGGER trg_plivd_updated_at
    BEFORE UPDATE ON public.pricing_list_item_version_dispatches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
