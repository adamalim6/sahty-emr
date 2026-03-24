-- Migration: 074_lab_reference_system_refactor_global.sql
-- Description: Refactor the LIMS reference range system to a context-driven, rule-based architecture.
-- Context: public schema representing sahty_global

BEGIN;

-- PHASE 1: Clean up any legacy tables (just in case they were replicated here)
DROP TABLE IF EXISTS public.lab_analyte_reference_ranges CASCADE;

-- PHASE 2 — CREATE DOMAIN VOCABULARY
CREATE TABLE public.lab_canonical_allowed_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    category TEXT NULL,
    ordinal_rank INTEGER NULL,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- PHASE 4 — CREATE REFERENCE PROFILES
CREATE TABLE public.lab_reference_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analyte_context_id uuid NOT NULL
        REFERENCES public.lab_analyte_contexts(id),
    sex TEXT NULL CHECK (sex IN ('M', 'F', 'U')),
    age_min_days INTEGER NULL,
    age_max_days INTEGER NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    actif BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    source TEXT NULL,
    notes TEXT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate profiles
CREATE UNIQUE INDEX uq_lab_reference_profile_global
ON public.lab_reference_profiles (
    analyte_context_id,
    COALESCE(sex, 'U'),
    COALESCE(age_min_days, -1),
    COALESCE(age_max_days, -1)
);

-- PHASE 5 — CREATE REFERENCE RULES
CREATE TABLE public.lab_reference_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL
        REFERENCES public.lab_reference_profiles(id)
        ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (
        rule_type IN (
            'NUMERIC_INTERVAL',
            'NUMERIC_THRESHOLD',
            'CATEGORICAL',
            'ORDINAL'
        )
    ),
    interpretation TEXT NOT NULL CHECK (
        interpretation IN (
            'NORMAL',
            'LOW',
            'HIGH',
            'CRITICAL_LOW',
            'CRITICAL_HIGH',
            'BORDERLINE',
            'ABNORMAL'
        )
    ),
    priority INTEGER NOT NULL DEFAULT 0,

    -- Numeric logic
    lower_numeric NUMERIC(18,6) NULL,
    upper_numeric NUMERIC(18,6) NULL,
    lower_inclusive BOOLEAN NOT NULL DEFAULT true,
    upper_inclusive BOOLEAN NOT NULL DEFAULT true,

    -- Categorical / ordinal logic
    canonical_value_id uuid NULL
        REFERENCES public.lab_canonical_allowed_values(id),
    canonical_value_min_id uuid NULL
        REFERENCES public.lab_canonical_allowed_values(id),
    canonical_value_max_id uuid NULL
        REFERENCES public.lab_canonical_allowed_values(id),

    -- Display / reporting
    display_text TEXT NULL,
    reference_text TEXT NULL,
    actif BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- PHASE 6 — OPTIONAL SAFETY (HIGHLY RECOMMENDED)
-- Prevent overlapping numeric rules
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.lab_reference_rules
ADD CONSTRAINT no_overlap_numeric_ranges_global
EXCLUDE USING gist (
    profile_id WITH =,
    (numrange(lower_numeric, upper_numeric)) WITH &&
)
WHERE (rule_type IN ('NUMERIC_INTERVAL', 'NUMERIC_THRESHOLD'));

COMMIT;
