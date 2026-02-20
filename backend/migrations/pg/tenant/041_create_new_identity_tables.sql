-- Migration 041: Create New Identity Tables (Identity IDs, Relationships, Coverage)

-- 1. Create identity_ids table (Replaces patient_documents + MRN)
CREATE TABLE IF NOT EXISTS "public"."identity_ids" (
    "identity_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tenant_patient_id" UUID NOT NULL REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE CASCADE,
    "identity_type_code" TEXT NOT NULL, -- LOCAL_MRN, NATIONAL_ID, PASSPORT, SAHTY_MPI_PERSON_ID
    "identity_value" TEXT NOT NULL,
    "issuing_country_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes and Constraints for identity_ids
CREATE INDEX idx_identity_ids_patient ON "public"."identity_ids"("tenant_id", "tenant_patient_id");
CREATE INDEX idx_identity_ids_lookup ON "public"."identity_ids"("tenant_id", "identity_type_code", "identity_value");

-- Unique MRN per tenant
CREATE UNIQUE INDEX idx_unique_mrn_per_tenant ON "public"."identity_ids"("tenant_id", "identity_type_code", "identity_value") 
WHERE "identity_type_code" = 'LOCAL_MRN' AND "status" = 'ACTIVE';

-- Unique National ID per tenant (prevent duplicates)
CREATE UNIQUE INDEX idx_unique_nid_per_tenant ON "public"."identity_ids"("tenant_id", "identity_type_code", "identity_value", "issuing_country_code") 
WHERE "identity_type_code" IN ('NATIONAL_ID', 'PASSPORT', 'CIN') AND "status" = 'ACTIVE';


-- 2. Create patient_identity_change table (Unified Log)
CREATE TABLE IF NOT EXISTS "public"."patient_identity_change" (
    "change_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tenant_patient_id" UUID NOT NULL REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE CASCADE,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "changed_by_user_id" UUID, -- Nullable for system/sync
    "change_source" TEXT NOT NULL, -- USER_UI, SYSTEM, SYNC
    "field_path" TEXT NOT NULL, -- e.g. patients_tenant.last_name, identity_ids[NATIONAL_ID]
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT
);

CREATE INDEX idx_identity_change_patient ON "public"."patient_identity_change"("tenant_id", "tenant_patient_id");


-- 3. Create patient_relationship_links table (Consolidated + External Support)
CREATE TABLE IF NOT EXISTS "public"."patient_relationship_links" (
    "relationship_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "subject_tenant_patient_id" UUID NOT NULL REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE CASCADE,
    
    -- Link to another patient (optional)
    "related_tenant_patient_id" UUID REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE SET NULL,
    
    -- External Party Fields (used if related_tenant_patient_id is NULL)
    "related_first_name" TEXT,
    "related_last_name" TEXT,
    "related_identity_type_code" TEXT,
    "related_identity_value" TEXT,
    "related_issuing_country_code" TEXT,

    "relationship_type_code" TEXT NOT NULL, -- MOTHER, FATHER, GUARDIAN, SPOUSE, etc.
    
    -- Role Flags
    "is_legal_guardian" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_decision_maker" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_emergency_contact" BOOLEAN NOT NULL DEFAULT FALSE,
    
    "priority" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rel_links_subject ON "public"."patient_relationship_links"("tenant_id", "subject_tenant_patient_id");
CREATE INDEX idx_rel_links_related ON "public"."patient_relationship_links"("tenant_id", "related_tenant_patient_id");

-- Prevent duplicate relationships (Subject -> Related Patient)
CREATE UNIQUE INDEX idx_unique_rel_patient ON "public"."patient_relationship_links"
("tenant_id", "subject_tenant_patient_id", "related_tenant_patient_id", "relationship_type_code")
WHERE "related_tenant_patient_id" IS NOT NULL;


-- 4. Create Coverage Tables (Epic Style)

-- 4a. Coverages (The Policy)
CREATE TABLE IF NOT EXISTS "public"."coverages" (
    "coverage_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "organisme_id" UUID NOT NULL REFERENCES "reference"."organismes"("id"),
    "policy_number" TEXT NOT NULL,
    "group_number" TEXT,
    "plan_name" TEXT,
    "coverage_type_code" TEXT, -- CNOPS, CNSS, PRIVATE
    "effective_from" DATE,
    "effective_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coverages_lookup ON "public"."coverages"("tenant_id", "organisme_id", "policy_number");


-- 4b. Coverage Members (The Roster)
CREATE TABLE IF NOT EXISTS "public"."coverage_members" (
    "coverage_member_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "coverage_id" UUID NOT NULL REFERENCES "public"."coverages"("coverage_id") ON DELETE CASCADE,
    "tenant_patient_id" UUID NOT NULL REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE CASCADE,
    "relationship_to_subscriber_code" TEXT, -- SELF, SPOUSE, CHILD
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unique_coverage_member ON "public"."coverage_members"("coverage_id", "tenant_patient_id");


-- 4c. Patient Coverages (Filing Order / Usage)
CREATE TABLE IF NOT EXISTS "public"."patient_coverages" (
    "patient_coverage_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tenant_patient_id" UUID NOT NULL REFERENCES "public"."patients_tenant"("tenant_patient_id") ON DELETE CASCADE,
    "coverage_id" UUID NOT NULL REFERENCES "public"."coverages"("coverage_id") ON DELETE CASCADE,
    "filing_order" INTEGER NOT NULL DEFAULT 1, -- 1=Primary
    "effective_from" DATE,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pt_coverages_patient ON "public"."patient_coverages"("tenant_id", "tenant_patient_id");
CREATE UNIQUE INDEX idx_pt_coverages_order ON "public"."patient_coverages"("tenant_patient_id", "filing_order") WHERE "is_active" = TRUE;
