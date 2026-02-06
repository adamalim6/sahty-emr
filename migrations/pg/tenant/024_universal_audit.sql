-- Universal Audit Log (Tenant)
-- Migration ID: 024
-- Description: Adds generic audit log with append-only enforcement and TXID tracking to Tenant DB.

-- 1. Create Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID,   -- Captures the tenant ID context
    
    table_name   TEXT NOT NULL,
    record_id    UUID NOT NULL,   -- PK of affected row
    
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
    ten_id UUID;
BEGIN
    -- Try to get user_id from session context
    BEGIN
        user_id := current_setting('sahty.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NULL;
    END;

    -- Determine Record ID (Generic PK assumption: Argument 0 or 'id')
    -- For Tenant DBs, we mostly use UUIDs.
    
    IF (TG_OP = 'DELETE') THEN
        IF (TG_NARGS > 0) THEN
            rec_id := (row_to_json(OLD) ->> TG_ARGV[0])::UUID;
        ELSE
             rec_id := (row_to_json(OLD) ->> 'id')::UUID;
        END IF;
        
        -- Try to capture tenant_id if available in the record
        -- Most tenant tables have 'tenant_id' column, or we are in a tenant DB so implicit?
        -- But audit_log has a column `tenant_id`. 
        -- If the row has tenant_id, use it. Else NULL (implicit from DB context).
        -- CAST required? JSONB -> TEXT -> UUID
        BEGIN
            ten_id := (row_to_json(OLD) ->> 'tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            ten_id := NULL;
        END;

        INSERT INTO audit_log (
            tenant_id, table_name, record_id, action, old_data, new_data, changed_by, operation_txid
        ) VALUES (
            ten_id,
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

        BEGIN
            ten_id := (row_to_json(NEW) ->> 'tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            ten_id := NULL;
        END;

        INSERT INTO audit_log (
            tenant_id, table_name, record_id, action, old_data, new_data, changed_by, operation_txid
        ) VALUES (
            ten_id,
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

        BEGIN
            ten_id := (row_to_json(NEW) ->> 'tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            ten_id := NULL;
        END;

        INSERT INTO audit_log (
            tenant_id, table_name, record_id, action, old_data, new_data, changed_by, operation_txid
        ) VALUES (
            ten_id,
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


-- 5. Apply Triggers (Tenant)
-- Pass the PK name as argument to the trigger function

DROP TRIGGER IF EXISTS audit_patients_tenant ON patients_tenant;
CREATE TRIGGER audit_patients_tenant
AFTER INSERT OR UPDATE OR DELETE ON patients_tenant
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('tenant_patient_id');

DROP TRIGGER IF EXISTS audit_patient_relationships ON patient_relationships;
CREATE TRIGGER audit_patient_relationships
AFTER INSERT OR UPDATE OR DELETE ON patient_relationships
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('relationship_id');

DROP TRIGGER IF EXISTS audit_patient_emergency_contacts ON patient_emergency_contacts;
CREATE TRIGGER audit_patient_emergency_contacts
AFTER INSERT OR UPDATE OR DELETE ON patient_emergency_contacts
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('emergency_contact_id');

DROP TRIGGER IF EXISTS audit_patient_legal_guardians ON patient_legal_guardians;
CREATE TRIGGER audit_patient_legal_guardians
AFTER INSERT OR UPDATE OR DELETE ON patient_legal_guardians
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('legal_guardian_id');

DROP TRIGGER IF EXISTS audit_patient_decision_makers ON patient_decision_makers;
CREATE TRIGGER audit_patient_decision_makers
AFTER INSERT OR UPDATE OR DELETE ON patient_decision_makers
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('decision_maker_id');

DROP TRIGGER IF EXISTS audit_patient_insurances ON patient_insurances;
CREATE TRIGGER audit_patient_insurances
AFTER INSERT OR UPDATE OR DELETE ON patient_insurances
FOR EACH ROW EXECUTE FUNCTION func_audit_log_trigger('patient_insurance_id');
