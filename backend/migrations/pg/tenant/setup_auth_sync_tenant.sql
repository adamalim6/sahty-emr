-- ============================================================
-- Auth Sync — Tenant Schema (each tenant DB)
-- Outbox/Inbox event tables + triggers for bidirectional auth sync
-- Applied to ALL tenants (STANDALONE + GROUP_MANAGED).
-- Sync worker only processes GROUP_MANAGED tenants.
-- Mirrors: 028_identity_sync_tenant.sql
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth_sync;

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Outbox: events emitted by triggers on auth.* writes
CREATE TABLE IF NOT EXISTS auth_sync.outbox_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type       TEXT NOT NULL,      -- 'users', 'credentials', 'user_tenants'
    entity_id         TEXT NOT NULL,      -- PK value (UUID or composite key as text)
    operation         TEXT NOT NULL,      -- 'UPSERT' | 'DELETE'
    payload           JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at      TIMESTAMPTZ        -- NULL until sent to group
);

CREATE INDEX IF NOT EXISTS idx_auth_outbox_unprocessed
    ON auth_sync.outbox_events (created_at)
    WHERE processed_at IS NULL;

-- Inbox: canonical events pulled from group
CREATE TABLE IF NOT EXISTS auth_sync.inbox_events (
    event_id          UUID PRIMARY KEY,   -- Same UUID as group outbox event_id
    source_tenant_id  UUID,               -- Which tenant originated the change (NULL = group)
    entity_type       TEXT NOT NULL,
    entity_id         TEXT NOT NULL,
    operation         TEXT NOT NULL,
    payload           JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at        TIMESTAMPTZ         -- NULL until applied locally
);

CREATE INDEX IF NOT EXISTS idx_auth_inbox_unapplied
    ON auth_sync.inbox_events (created_at)
    WHERE applied_at IS NULL;

-- Sync state: single-row cursor tracking
CREATE TABLE IF NOT EXISTS auth_sync.sync_state (
    id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Enforce single row
    last_group_outbox_seq   BIGINT NOT NULL DEFAULT 0,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO auth_sync.sync_state (id, last_group_outbox_seq)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. TRIGGER FUNCTION
-- ============================================================

-- Single shared trigger function for all auth.* tables (except audit_log)
CREATE OR REPLACE FUNCTION auth_sync.emit_outbox_event()
RETURNS TRIGGER AS $$
DECLARE
    v_entity_type TEXT;
    v_entity_id   TEXT;
    v_operation   TEXT;
    v_payload     JSONB;
BEGIN
    -- Skip if we are applying incoming sync events (prevent echo loops)
    IF current_setting('auth_sync.applying', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Determine entity type from table name
    v_entity_type := TG_TABLE_NAME;

    -- Build event based on operation
    IF TG_OP = 'DELETE' THEN
        v_operation := 'DELETE';
        v_payload   := to_jsonb(OLD);

        -- Entity-specific PK extraction
        CASE TG_TABLE_NAME
            WHEN 'users' THEN
                v_entity_id := OLD.user_id::text;
            WHEN 'credentials' THEN
                v_entity_id := OLD.credential_id::text;
            WHEN 'user_tenants' THEN
                -- Composite PK: encode as "user_id::tenant_id"
                v_entity_id := OLD.user_id::text || '::' || OLD.tenant_id::text;
        END CASE;
    ELSE
        -- INSERT or UPDATE
        v_operation := 'UPSERT';
        v_payload   := to_jsonb(NEW);

        CASE TG_TABLE_NAME
            WHEN 'users' THEN
                v_entity_id := NEW.user_id::text;
            WHEN 'credentials' THEN
                v_entity_id := NEW.credential_id::text;
            WHEN 'user_tenants' THEN
                v_entity_id := NEW.user_id::text || '::' || NEW.tenant_id::text;
        END CASE;
    END IF;

    -- Emit to outbox (same transaction = atomic)
    INSERT INTO auth_sync.outbox_events (entity_type, entity_id, operation, payload)
    VALUES (v_entity_type, v_entity_id, v_operation, v_payload);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 3. TRIGGERS (3 tables × 3 operations = 9 triggers)
-- ============================================================

-- auth.users
CREATE OR REPLACE TRIGGER trg_auth_sync_users_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_auth_sync_users_update
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_auth_sync_users_delete
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

-- auth.credentials
CREATE OR REPLACE TRIGGER trg_auth_sync_credentials_insert
    AFTER INSERT ON auth.credentials
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_auth_sync_credentials_update
    AFTER UPDATE ON auth.credentials
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_auth_sync_credentials_delete
    AFTER DELETE ON auth.credentials
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

-- auth.user_tenants
CREATE OR REPLACE TRIGGER trg_auth_sync_user_tenants_insert
    AFTER INSERT ON auth.user_tenants
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_auth_sync_user_tenants_update
    AFTER UPDATE ON auth.user_tenants
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_auth_sync_user_tenants_delete
    AFTER DELETE ON auth.user_tenants
    FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();
