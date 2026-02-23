-- Safely cast default_presc_unit from TEXT to UUID

-- 1. Using a regex matcher to only cast rows that actually look like a UUID
-- 2. Any arbitrary text (e.g. "comprimés", "gouttes (drops / gtt)") will be cleanly zeroed out to NULL instead of crashing the migration

ALTER TABLE public.global_products 
    ALTER COLUMN default_presc_unit TYPE uuid 
    USING CASE 
        WHEN default_presc_unit ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN default_presc_unit::uuid 
        ELSE NULL 
    END;
