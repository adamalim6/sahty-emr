CREATE OR REPLACE FUNCTION fn_generic_audit() RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Extract Record ID (Handle logic for different PKs)
    IF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'patients_tenant') THEN
            v_record_id := OLD.tenant_patient_id;
        ELSIF (TG_TABLE_NAME = 'identity_ids') THEN
            v_record_id := OLD.identity_id;
        ELSIF (TG_TABLE_NAME = 'patient_relationship_links') THEN
            v_record_id := OLD.relationship_id;
        ELSIF (TG_TABLE_NAME = 'patient_coverages') THEN
            v_record_id := OLD.patient_coverage_id;
        ELSIF (TG_TABLE_NAME = 'coverages') THEN
            v_record_id := OLD.coverage_id;
        ELSE
            -- Default to 'id' if possible
            BEGIN
                v_record_id := OLD.id;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL; -- Or raise warning
            END;
        END IF;
        v_old_data := to_jsonb(OLD);
    ELSE
        IF (TG_TABLE_NAME = 'patients_tenant') THEN
            v_record_id := NEW.tenant_patient_id;
        ELSIF (TG_TABLE_NAME = 'identity_ids') THEN
            v_record_id := NEW.identity_id;
        ELSIF (TG_TABLE_NAME = 'patient_relationship_links') THEN
            v_record_id := NEW.relationship_id;
        ELSIF (TG_TABLE_NAME = 'patient_coverages') THEN
            v_record_id := NEW.patient_coverage_id;
        ELSIF (TG_TABLE_NAME = 'coverages') THEN
            v_record_id := NEW.coverage_id;
        ELSE
            BEGIN
                v_record_id := NEW.id;
            EXCEPTION WHEN OTHERS THEN
                 v_record_id := NULL;
            END;
        END IF;
        v_new_data := to_jsonb(NEW);
        
        IF (TG_OP = 'UPDATE') THEN
            v_old_data := to_jsonb(OLD);
        END IF;
    END IF;

    -- 2. Extract User ID from session (if available)
    BEGIN
        v_user_id := current_setting('sahty.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- 3. Insert Audit Log (Targeting public.audit_log)
    INSERT INTO public.audit_log (
        tenant_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        changed_at,
        operation_txid
    ) VALUES (
        CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id,
        NOW(),
        txid_current()
    );

    RETURN NULL; -- trigger is AFTER, return is ignored
END;
$$ LANGUAGE plpgsql;
