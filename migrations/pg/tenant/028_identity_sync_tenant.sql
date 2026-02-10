-- ============================================================
-- Identity Sync — Tenant Schema (each tenant DB)
-- Outbox/Inbox event tables + triggers for bidirectional MPI sync
-- ============================================================

CREATE SCHEMA IF NOT EXISTS identity_sync;

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Outbox: events emitted by triggers on identity.* writes
CREATE TABLE IF NOT EXISTS identity_sync.outbox_events (
    event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type       TEXT NOT NULL,      -- 'master_patient', 'master_patient_document', etc.
    entity_id         UUID NOT NULL,
    operation         TEXT NOT NULL,      -- 'UPSERT' | 'DELETE'
    payload           JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at      TIMESTAMPTZ        -- NULL until sent to central
);

CREATE INDEX IF NOT EXISTS idx_tenant_outbox_unprocessed
    ON identity_sync.outbox_events (created_at)
    WHERE processed_at IS NULL;

-- Inbox: canonical events pulled from central
CREATE TABLE IF NOT EXISTS identity_sync.inbox_events (
    event_id          UUID PRIMARY KEY,   -- Same UUID as central outbox event_id
    source_tenant_id  UUID,               -- Which tenant originated the change (NULL = central)
    entity_type       TEXT NOT NULL,
    entity_id         UUID NOT NULL,
    operation         TEXT NOT NULL,
    payload           JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at        TIMESTAMPTZ         -- NULL until applied locally

    -- UNIQUE (event_id) is guaranteed by PRIMARY KEY
);

CREATE INDEX IF NOT EXISTS idx_tenant_inbox_unapplied
    ON identity_sync.inbox_events (created_at)
    WHERE applied_at IS NULL;

-- Sync state: single-row cursor tracking
CREATE TABLE IF NOT EXISTS identity_sync.sync_state (
    id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Enforce single row
    last_central_outbox_seq BIGINT NOT NULL DEFAULT 0,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO identity_sync.sync_state (id, last_central_outbox_seq)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. TRIGGER FUNCTION
-- ============================================================

-- Single shared trigger function for all identity.* tables
CREATE OR REPLACE FUNCTION identity_sync.emit_outbox_event()
RETURNS TRIGGER AS $$
DECLARE
    v_entity_type TEXT;
    v_entity_id   UUID;
    v_operation   TEXT;
    v_payload     JSONB;
BEGIN
    -- Skip if we are applying incoming sync events (prevent echo loops)
    IF current_setting('identity_sync.applying', true) = 'true' THEN
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
        v_entity_id := OLD.id;
        v_payload   := to_jsonb(OLD);
    ELSE
        -- INSERT or UPDATE
        v_operation := 'UPSERT';
        v_entity_id := NEW.id;
        v_payload   := to_jsonb(NEW);
    END IF;

    -- Emit to outbox (same transaction = atomic)
    INSERT INTO identity_sync.outbox_events (entity_type, entity_id, operation, payload)
    VALUES (v_entity_type, v_entity_id, v_operation, v_payload);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 3. TRIGGERS (4 tables × 3 operations = 12 triggers)
-- ============================================================

-- master_patients
CREATE OR REPLACE TRIGGER trg_sync_master_patients_insert
    AFTER INSERT ON identity.master_patients
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patients_update
    AFTER UPDATE ON identity.master_patients
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patients_delete
    AFTER DELETE ON identity.master_patients
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

-- master_patient_documents
CREATE OR REPLACE TRIGGER trg_sync_master_patient_documents_insert
    AFTER INSERT ON identity.master_patient_documents
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patient_documents_update
    AFTER UPDATE ON identity.master_patient_documents
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patient_documents_delete
    AFTER DELETE ON identity.master_patient_documents
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

-- master_patient_aliases
CREATE OR REPLACE TRIGGER trg_sync_master_patient_aliases_insert
    AFTER INSERT ON identity.master_patient_aliases
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patient_aliases_update
    AFTER UPDATE ON identity.master_patient_aliases
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patient_aliases_delete
    AFTER DELETE ON identity.master_patient_aliases
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

-- master_patient_merge_events
CREATE OR REPLACE TRIGGER trg_sync_master_patient_merge_events_insert
    AFTER INSERT ON identity.master_patient_merge_events
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patient_merge_events_update
    AFTER UPDATE ON identity.master_patient_merge_events
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();

CREATE OR REPLACE TRIGGER trg_sync_master_patient_merge_events_delete
    AFTER DELETE ON identity.master_patient_merge_events
    FOR EACH ROW EXECUTE FUNCTION identity_sync.emit_outbox_event();
