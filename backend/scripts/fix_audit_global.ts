import { getGlobalPool } from '../db/globalPg';

async function fixAudit() {
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        await client.query(`
CREATE OR REPLACE FUNCTION public.fn_generic_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_record_id TEXT;
    v_parsed_uuid UUID;
    v_changed_by UUID;
BEGIN
    v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
    v_changed_by := NULLIF(current_setting('app.user_id', true), '')::uuid;

    IF TG_OP = 'DELETE' THEN
        BEGIN
            EXECUTE 'SELECT $1.id' INTO v_record_id USING OLD;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;
        BEGIN
            v_parsed_uuid := v_record_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_parsed_uuid := '00000000-0000-0000-0000-000000000000'::uuid;
        END;

        INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, old_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_parsed_uuid, 'DELETE', row_to_json(OLD)::jsonb, v_changed_by, txid_current());
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        BEGIN
            EXECUTE 'SELECT $1.id' INTO v_record_id USING NEW;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;
        BEGIN
            v_parsed_uuid := v_record_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_parsed_uuid := '00000000-0000-0000-0000-000000000000'::uuid;
        END;

        INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, old_data, new_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_parsed_uuid, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_changed_by, txid_current());
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        BEGIN
            EXECUTE 'SELECT $1.id' INTO v_record_id USING NEW;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;
        BEGIN
            v_parsed_uuid := v_record_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_parsed_uuid := '00000000-0000-0000-0000-000000000000'::uuid;
        END;

        INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, new_data, changed_by, operation_txid)
        VALUES (v_tenant_id, TG_TABLE_NAME, v_parsed_uuid, 'INSERT', row_to_json(NEW)::jsonb, v_changed_by, txid_current());
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
        `);
        console.log("Fixed audit function.");
    } finally {
        client.release();
        await pool.end();
    }
}
fixAudit().catch(console.error);
