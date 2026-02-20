-- Migration 042: Setup Identity Sync Schema

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS "identity_sync";

-- 2. Outbox Events (Tenant -> Central)
CREATE TABLE IF NOT EXISTS "identity_sync"."outbox_events" (
    "event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL, -- PATIENT_UPSERT, IDENTIFIER_UPSERT, IDENTIFIER_DELETE
    "entity_type" TEXT NOT NULL, -- patients_tenant, identity_ids
    "entity_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "status" TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, ACKED, FAILED
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "dedupe_key" TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_outbox_dedupe ON "identity_sync"."outbox_events"("dedupe_key");
CREATE INDEX idx_outbox_processing ON "identity_sync"."outbox_events"("status", "next_attempt_at");


-- 3. Inbox Events (Central -> Tenant)
CREATE TABLE IF NOT EXISTS "identity_sync"."inbox_events" (
    "inbox_event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL, -- MPI_ASSIGNMENT, MERGE_DIRECTIVE
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "applied_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, APPLIED, FAILED
    "dedupe_key" TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_inbox_dedupe ON "identity_sync"."inbox_events"("dedupe_key");
CREATE INDEX idx_inbox_processing ON "identity_sync"."inbox_events"("status");
