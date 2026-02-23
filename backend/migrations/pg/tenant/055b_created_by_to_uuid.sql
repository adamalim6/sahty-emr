-- Migration 055b: Change created_by from TEXT to UUID in prescriptions
-- Idempotent

DO $$
BEGIN
    -- Only alter if the column is currently TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'prescriptions'
          AND column_name = 'created_by'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE prescriptions ALTER COLUMN created_by TYPE UUID USING created_by::uuid;
    END IF;
END $$;
