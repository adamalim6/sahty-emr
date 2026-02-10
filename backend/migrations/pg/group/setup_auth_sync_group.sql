-- ============================================================
-- Auth Sync — Group Schema (each group_<id> database)
-- Inbox/Outbox event tables for bidirectional auth sync
-- Mirrors: setup_identity_sync_central.sql
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth_sync;

-- 1. Inbox: receives events from tenants (Sync UP landing zone)
CREATE TABLE IF NOT EXISTS auth_sync.inbox_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id  UUID NOT NULL,
    entity_type       TEXT NOT NULL,      -- 'users', 'credentials', 'user_tenants'
    entity_id         TEXT NOT NULL,      -- PK value (UUID or composite key as text)
    operation         TEXT NOT NULL,      -- 'UPSERT' | 'DELETE'
    payload           JSONB NOT NULL,
    source_event_id   UUID,              -- Original event_id from tenant outbox
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at      TIMESTAMPTZ,       -- NULL until processed

    -- DB-level idempotency: same tenant cannot submit same event twice
    CONSTRAINT uq_auth_inbox_source UNIQUE (source_tenant_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_inbox_unprocessed
    ON auth_sync.inbox_events (created_at)
    WHERE processed_at IS NULL;

-- 2. Outbox: canonical events to redistribute to tenants (Sync DOWN source)
CREATE TABLE IF NOT EXISTS auth_sync.outbox_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_seq        BIGSERIAL UNIQUE,  -- Monotonic cursor for ordered consumption
    source_tenant_id  UUID,              -- NULL for group-originated events
    entity_type       TEXT NOT NULL,
    entity_id         TEXT NOT NULL,
    operation         TEXT NOT NULL,
    payload           JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_outbox_seq
    ON auth_sync.outbox_events (outbox_seq);

-- 3. Tenant cursors: per-tenant position in the outbox stream
CREATE TABLE IF NOT EXISTS auth_sync.tenant_cursors (
    tenant_id          UUID PRIMARY KEY,
    last_outbox_seq    BIGINT NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
