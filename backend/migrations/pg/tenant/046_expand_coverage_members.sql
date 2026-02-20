-- Migration 046: Expand coverage_members for external subscribers
-- Created: 2026-02-18

-- 1. Make tenant_patient_id nullable (for external subscribers who are not patients)
ALTER TABLE "public"."coverage_members"
    ALTER COLUMN "tenant_patient_id" DROP NOT NULL;

-- 2. Add fields for external member/subscriber details
ALTER TABLE "public"."coverage_members"
    ADD COLUMN "member_first_name" TEXT,
    ADD COLUMN "member_last_name" TEXT,
    ADD COLUMN "member_identity_type" TEXT,
    ADD COLUMN "member_identity_value" TEXT,
    ADD COLUMN "member_issuing_country" TEXT;

-- 3. Ensure only one subscriber (SELF) per coverage
-- existing index idx_cov_mem_unique is (coverage_id, tenant_patient_id)
-- If tenant_patient_id is NULL, multiple rows could exist. 
-- We want to ensure at most one 'SELF' row per coverage.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coverage_subscriber_unique 
    ON "public"."coverage_members" (coverage_id) 
    WHERE relationship_to_subscriber_code = 'SELF';
