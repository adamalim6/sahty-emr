-- Migration 061: Refactor Transfusion Prescriptions
-- This script replaces the hardcoded "poche(s)" unit with a UUID reference to the POCHE unit in the reference.units catalog.
-- Ensures strict compliance with global reference data structure, improving interoperability and normalization.

-- First, ensure that the tenant has the unit POCHE synced. (Usually reference schemas are hydrated).
-- We assume it already exists based on verification script check_poche.ts.

DO $$
DECLARE
    poche_unit_id UUID;
    tenantRecord record;
BEGIN
    FOR tenantRecord IN SELECT id FROM public.tenants
    LOOP
        -- Find the POCHE unit id inside this tenant
        -- Using dynamic SQL depending on schema placement, falling back to assuming it exists.
        -- We will query 'reference.units' and cache the UUID.
        EXECUTE format('SELECT id FROM %I.reference_units WHERE code = $1 LIMIT 1', tenantRecord.id)
        USING 'POCHE'
        INTO poche_unit_id;

        IF poche_unit_id IS NOT NULL THEN
            -- Update local prescriptions where type is transfusion and unit was hardcoded
            -- Update JSONB:
            -- 1. convert qty from string to number
            -- 2. add unit_id
            -- 3. delete unit
            -- 4. Set blood_product_type to "CGR" (assuming existing legacy prototypes were almost exclusively CGR).
            
            EXECUTE format('
                UPDATE %I.prescriptions
                SET details = jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        details - ''unit'',
                                        ''{unit_id}'',
                                        to_jsonb($1::uuid)
                                    ),
                                    ''{qty}'',
                                    to_jsonb( COALESCE(NULLIF(details->>''qty'', '''')::numeric, 1) )
                                ),
                                ''{blood_product_type}'',
                                ''"CGR"''::jsonb
                              )
                WHERE prescription_type = ''transfusion''
                  AND details->>''unit'' = ''poche(s)'';
            ', tenantRecord.id)
            USING poche_unit_id;
            
        ELSE
            RAISE NOTICE 'POCHE unit not found for tenant %', tenantRecord.id;
        END IF;
    END LOOP;
END;
$$;
