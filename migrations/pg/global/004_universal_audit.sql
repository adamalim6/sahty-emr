-- Universal Audit Log (Global)
-- Migration ID: 004
-- Description: Adds generic audit log with append-only enforcement and TXID tracking.

-- 1. Create Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID,   -- Generic column, usually NULL in global DB context unless specified
    
    table_name   TEXT NOT NULL,
    record_id    UUID NOT NULL,   -- PK of affected row (assumes UUID PKs)
    
    action       TEXT NOT NULL,   -- 'INSERT', 'UPDATE', 'DELETE'
    
    old_data     JSONB,            -- Pre-change state
    new_data     JSONB,            -- Post-change state
    
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by   UUID,             -- Captured from session context
    operation_txid BIGINT          -- Captured from txid_current()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);


-- 3. Append-Only Enforcement Trigger
CREATE OR REPLACE FUNCTION forbid_audit_log_modifications()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_modifications();


-- 4. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION func_audit_log_trigger()
RETURNS trigger AS $$
DECLARE
    user_id UUID;
    rec_id UUID;
BEGIN
    -- Try to get user_id from session context
    BEGIN
        user_id := current_setting('sahty.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NULL;
    END;

    -- Determine Record ID (generic assumption: PK is the first column or standard ID naming?)
    -- Ideally we know the PK. For our schema, everything is UUID keys. 
    -- We can try to use a convention or dynamic lookup.
    -- Convention: if NEW exists, use NEW.id or similar.
    -- For SaaS/EMR, our tables usually have `{table}_id` or `id`.
    -- Simplest generic approach for this project: Use the first column value if UUID, or specific logic.
    -- Let's assume the PK is the first column logic for now as Project Standard, 
    -- OR specific hardcoded mapping is safer but less generic.
    -- Actually, for PL/pgSQL generic triggers, using `NEW` record structure is common.
    -- Let's assume PK is `id` or `{singular_table_name}_id`. 
    
    IF (TG_OP = 'DELETE') THEN
        -- Attempt to find the ID. 
        -- NOTE: Dynamic introspection of PK in PLPGSQL is heavy.
        -- We will assume the PK is available as the first column of the OLD record usually, 
        -- OR we just rely on standard naming if possible.
        -- Let's try to grab ID from explicit columns if they exist, else Generic first column?
        -- `OLD` is a record. 
        -- We can cast to JSONB and get the PK if we know the name?
        -- Actually, we can assume the PK is passed or we just log data. 
        
        -- Let's use a convention: The tables we audit ALL have UUID PKs.
        -- We can inspect `TG_ARGV[0]` if we pass PK name in arguments!
        -- usage: TRIGGER ... EXECUTE FUNCTION func_audit_log_trigger('global_patient_id')
        
        IF (TG_NARGS > 0) THEN
            rec_id := (row_to_json(OLD) ->> TG_ARGV[0])::UUID;
        ELSE
             -- Fallback or Error? Let's default to 'id' if no arg
             rec_id := (row_to_json(OLD) ->> 'id')::UUID;
             -- Or try tableName_id? Too complex generic.
        END IF;

        INSERT INTO audit_log (
            table_name, record_id, action, old_data, new_data, changed_by, operation_txid
        ) VALUES (
            TG_TABLE_NAME,
            rec_id,
            'DELETE',
            row_to_json(OLD),
            NULL,
            user_id,
            txid_current()
        );
        RETURN OLD;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (TG_NARGS > 0) THEN
            rec_id := (row_to_json(NEW) ->> TG_ARGV[0])::UUID;
        ELSE
            rec_id := (row_to_json(NEW) ->> 'id')::UUID;
        END IF;

        INSERT INTO audit_log (
            table_name, record_id, action, old_data, new_data, changed_by, operation_txid
        ) VALUES (
            TG_TABLE_NAME,
            rec_id,
            'UPDATE',
            row_to_json(OLD),
            row_to_json(NEW),
            user_id,
            txid_current()
        );
        RETURN NEW;
        
    ELSIF (TG_OP = 'INSERT') THEN
        IF (TG_NARGS > 0) THEN
            rec_id := (row_to_json(NEW) ->> TG_ARGV[0])::UUID;
        ELSE
             rec_id := (row_to_json(NEW) ->> 'id')::UUID;
        END IF;

        INSERT INTO audit_log (
            table_name, record_id, action, old_data, new_data, changed_by, operation_txid
        ) VALUES (
            TG_TABLE_NAME,
            rec_id,
            'INSERT',
            NULL,
            row_to_json(NEW),
            user_id,
            txid_current()
        );
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-- 5. Apply Triggers (Global)
-- Pass the PK name as argument to the trigger function

DROP TRIGGER IF EXISTS audit_patients_global ON patients_global;
CREATE TRIGGER audit_patients_global
AFTER INSERT OR UPDATE OR DELETE ON patients_global
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('global_patient_id');

DROP TRIGGER IF EXISTS audit_global_identity_documents ON global_identity_documents;
CREATE TRIGGER audit_global_identity_documents
AFTER INSERT OR UPDATE OR DELETE ON global_identity_documents
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('identity_document_id');

DROP TRIGGER IF EXISTS audit_countries ON countries;
CREATE TRIGGER audit_countries
AFTER INSERT OR UPDATE OR DELETE ON countries
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('country_id');
