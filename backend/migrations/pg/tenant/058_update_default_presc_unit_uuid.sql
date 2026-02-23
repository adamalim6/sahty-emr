-- Safely cast default_presc_unit from TEXT to UUID in the reference schema (tenant)

ALTER TABLE reference.global_products 
    ALTER COLUMN default_presc_unit TYPE uuid 
    USING CASE 
        WHEN default_presc_unit ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN default_presc_unit::uuid 
        ELSE NULL 
    END;
