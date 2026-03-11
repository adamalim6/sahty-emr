-- 073_fix_surveillance_trigger_bucket_time.sql
-- The previous trigger used NEW.recorded_at to determine the bucket hour, 
-- causing delayed retrospective data entries to falsely aggregate in the present hour.
-- We must explicitly group by NEW.bucket_start.

CREATE OR REPLACE FUNCTION update_surveillance_hour_bucket()
RETURNS TRIGGER AS $$
DECLARE
    event_value JSONB;
BEGIN

    IF NEW.value_numeric IS NULL AND NEW.value_text IS NULL AND NEW.value_boolean IS NULL THEN
        -- Handle Deletion: Remove key from the JSON object
        INSERT INTO surveillance_hour_buckets (
            id, tenant_id, tenant_patient_id, bucket_start, values
        ) VALUES (
            gen_random_uuid(), NEW.tenant_id, NEW.tenant_patient_id, NEW.bucket_start, '{}'::jsonb
        )
        ON CONFLICT (tenant_id, tenant_patient_id, bucket_start)
        DO UPDATE SET values = surveillance_hour_buckets.values - NEW.parameter_code;
    ELSE
        -- Handle Insertion
        IF NEW.value_numeric IS NOT NULL THEN event_value := to_jsonb(NEW.value_numeric);
        ELSIF NEW.value_text IS NOT NULL THEN event_value := to_jsonb(NEW.value_text);
        ELSE event_value := to_jsonb(NEW.value_boolean);
        END IF;

        INSERT INTO surveillance_hour_buckets (
            id, tenant_id, tenant_patient_id, bucket_start, values
        ) VALUES (
            gen_random_uuid(), NEW.tenant_id, NEW.tenant_patient_id, NEW.bucket_start, jsonb_build_object(NEW.parameter_code, event_value)
        )
        ON CONFLICT (tenant_id, tenant_patient_id, bucket_start)
        DO UPDATE SET values = surveillance_hour_buckets.values || jsonb_build_object(NEW.parameter_code, event_value);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
