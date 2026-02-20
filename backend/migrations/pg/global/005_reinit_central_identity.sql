-- Migration 005: Destructive Re-init of Central Identity (EMPI)

-- 1. Drop Old Schemas
DROP SCHEMA IF EXISTS "identity" CASCADE;
DROP SCHEMA IF EXISTS "identity_sync" CASCADE;

-- 2. Create Identity Schema
CREATE SCHEMA "identity";

-- 3. MPI Persons (The Cluster Shell)
CREATE TABLE "identity"."mpi_persons" (
    "mpi_person_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MPI Source Records (Tenant Patient Snapshots)
CREATE TABLE "identity"."mpi_source_records" (
    "source_record_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tenant_patient_id" UUID NOT NULL,
    "current_first_name" TEXT,
    "current_last_name" TEXT,
    "current_dob" DATE,
    "current_sex" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_source_record_lookup ON "identity"."mpi_source_records"("tenant_id", "tenant_patient_id");

-- 5. MPI Source Identifiers (Tenant IDs)
CREATE TABLE "identity"."mpi_source_identifiers" (
    "source_identifier_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "source_record_id" UUID NOT NULL REFERENCES "identity"."mpi_source_records"("source_record_id") ON DELETE CASCADE,
    "identity_type_code" TEXT NOT NULL,
    "identity_value" TEXT NOT NULL,
    "issuing_country_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_ident_lookup ON "identity"."mpi_source_identifiers"("identity_type_code", "identity_value");

-- 6. MPI Person Memberships (Link: Source -> MPI Person)
CREATE TABLE "identity"."mpi_person_memberships" (
    "membership_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "mpi_person_id" UUID NOT NULL REFERENCES "identity"."mpi_persons"("mpi_person_id") ON DELETE CASCADE,
    "source_record_id" UUID NOT NULL REFERENCES "identity"."mpi_source_records"("source_record_id") ON DELETE CASCADE,
    "link_status" TEXT NOT NULL DEFAULT 'LINKED', -- LINKED, PENDING_REVIEW, REJECTED
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "match_confidence" NUMERIC(5,2),
    "match_rule" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_membership_source ON "identity"."mpi_person_memberships"("source_record_id");
CREATE INDEX idx_membership_cluster ON "identity"."mpi_person_memberships"("mpi_person_id");

-- 7. MPI Merge Events
CREATE TABLE "identity"."mpi_merge_events" (
    "merge_event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "survivor_mpi_person_id" UUID NOT NULL,
    "merged_mpi_person_id" UUID NOT NULL,
    "merged_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "merged_by" TEXT,
    "reason" TEXT
);

-- 8. EMPI Identity Change (Central Audit)
CREATE TABLE "identity"."empi_identity_change" (
    "change_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "mpi_person_id" UUID,
    "source_record_id" UUID,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "change_source" TEXT NOT NULL, -- TENANT_SYNC, CENTRAL_MERGE, CENTRAL_REVIEW
    "field_path" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT
);

-- 9. Create Sync Schema
CREATE SCHEMA "identity_sync";

-- 10. Inbound Events (Tenant -> Central)
CREATE TABLE "identity_sync"."inbound_events" (
    "event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "processed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, PROCESSED, FAILED
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT
);

CREATE UNIQUE INDEX idx_inbound_dedupe ON "identity_sync"."inbound_events"("dedupe_key");
CREATE INDEX idx_inbound_processing ON "identity_sync"."inbound_events"("status");

-- 11. Outbound Events (Central -> Tenant)
CREATE TABLE "identity_sync"."outbound_events" (
    "event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL, -- MPI_ASSIGNMENT, MERGE_DIRECTIVE
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "sent_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'PENDING' -- PENDING, SENT, FAILED
);

CREATE UNIQUE INDEX idx_outbound_dedupe ON "identity_sync"."outbound_events"("dedupe_key");
CREATE INDEX idx_outbound_processing ON "identity_sync"."outbound_events"("status", "tenant_id");
