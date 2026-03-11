-- 038_surveillance_trigger.sql

CREATE OR REPLACE FUNCTION update_surveillance_hour_bucket()
RETURNS TRIGGER AS $$
DECLARE
    event_value jsonb;
BEGIN
    -- Determine which value column is populated
    IF NEW.value_numeric IS NOT NULL THEN
        event_value := to_jsonb(NEW.value_numeric);
    ELSIF NEW.value_text IS NOT NULL THEN
        event_value := to_jsonb(NEW.value_text);
    ELSIF NEW.value_boolean IS NOT NULL THEN
        event_value := to_jsonb(NEW.value_boolean);
    ELSE
        event_value := NULL;
    END IF;

    IF event_value IS NULL THEN
        -- Deletion proxy case: Remove the parameter from the JSON
        UPDATE surveillance_hour_buckets
        SET values = values - NEW.parameter_code
        WHERE tenant_id = NEW.tenant_id
          AND admission_id = NEW.admission_id
          AND tenant_patient_id = NEW.tenant_patient_id
          AND bucket_start = NEW.bucket_start;
    ELSE
        -- Upsert case
        INSERT INTO surveillance_hour_buckets (
            id,
            tenant_id,
            admission_id,
            tenant_patient_id,
            bucket_start,
            values
        )
        VALUES (
            gen_random_uuid(),
            NEW.tenant_id,
            NEW.admission_id,
            NEW.tenant_patient_id,
            NEW.bucket_start,
            jsonb_build_object(NEW.parameter_code, event_value)
        )
        ON CONFLICT (tenant_id, tenant_patient_id, bucket_start)
        DO UPDATE
        SET values = surveillance_hour_buckets.values || jsonb_build_object(NEW.parameter_code, event_value);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_surveillance_event_bucket ON surveillance_values_events;

CREATE TRIGGER trg_surveillance_event_bucket
AFTER INSERT ON surveillance_values_events
FOR EACH ROW
EXECUTE FUNCTION update_surveillance_hour_bucket();
