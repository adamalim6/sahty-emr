-- Migration 044: Replace patient_coverages with admission_coverages
-- Rationale: Admission is the financial container. Coverage selection is per-admission.

DROP TABLE IF EXISTS "public"."patient_coverages" CASCADE;

CREATE TABLE IF NOT EXISTS "public"."admission_coverages" (
    admission_coverage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    admission_id          UUID NOT NULL REFERENCES public.admissions(id),
    coverage_id           UUID NOT NULL REFERENCES public.coverages(coverage_id),
    filing_order          INTEGER NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_admission_coverage_order UNIQUE (admission_id, filing_order),
    CONSTRAINT uq_admission_coverage_pair  UNIQUE (admission_id, coverage_id)
);

CREATE INDEX idx_adm_cov_tenant_admission ON "public"."admission_coverages"(tenant_id, admission_id);
