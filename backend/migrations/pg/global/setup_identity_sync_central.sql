-- ============================================================
-- Identity Sync — Central Schema (sahty_identity)
-- Inbox/Outbox event tables for bidirectional MPI sync
-- ============================================================

CREATE SCHEMA IF NOT EXISTS identity_sync;

-- 1. Inbox: receives events from tenants (Sync UP landing zone)
CREATE TABLE IF NOT EXISTS identity_sync.inbox_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id  UUID NOT NULL,
    entity_type       TEXT NOT NULL,      -- 'master_patient', 'master_patient_document', etc.
    entity_id         UUID NOT NULL,
    operation         TEXT NOT NULL,      -- 'UPSERT' | 'DELETE' | 'MERGE'
    payload           JSONB NOT NULL,
    source_event_id   UUID,              -- Original event_id from tenant outbox
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at      TIMESTAMPTZ,       -- NULL until processed

    -- DB-level idempotency: same tenant cannot submit same event twice
    CONSTRAINT uq_inbox_source UNIQUE (source_tenant_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_unprocessed
    ON identity_sync.inbox_events (created_at)
    WHERE processed_at IS NULL;

-- 2. Outbox: canonical events to redistribute to tenants (Sync DOWN source)
CREATE TABLE IF NOT EXISTS identity_sync.outbox_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_seq        BIGSERIAL UNIQUE,  -- Monotonic cursor for ordered consumption
    source_tenant_id  UUID,              -- NULL for central-originated events
    entity_type       TEXT NOT NULL,
    entity_id         UUID NOT NULL,
    operation         TEXT NOT NULL,
    payload           JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_seq
    ON identity_sync.outbox_events (outbox_seq);

-- 3. Tenant cursors: per-tenant position in the outbox stream
CREATE TABLE IF NOT EXISTS identity_sync.tenant_cursors (
    tenant_id          UUID PRIMARY KEY,
    last_outbox_seq    BIGINT NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
