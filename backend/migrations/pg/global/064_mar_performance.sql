-- Migration 064: MAR Performance and Hydric Framework
-- Central reference updates in sahty_global

-- 1. Routes
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Units
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Observation Parameters Source Column
ALTER TABLE observation_parameters 
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_observation_source'
    ) THEN
        ALTER TABLE observation_parameters
        ADD CONSTRAINT chk_observation_source
        CHECK (source IN ('manual','calculated'));
    END IF;
END $$;

-- 4. Insert Required Hydric Parameters into Global Catalog
INSERT INTO observation_parameters (id, code, label, value_type, source, is_hydric_input, is_hydric_output, sort_order)
VALUES 
    (gen_random_uuid(), 'HYDRIC_INPUT', 'Apports (Hydrique)', 'numeric', 'calculated', TRUE, FALSE, 1000),
    (gen_random_uuid(), 'HYDRIC_OUTPUT', 'Pertes (Hydrique)', 'numeric', 'calculated', FALSE, TRUE, 1010),
    (gen_random_uuid(), 'HYDRIC_BALANCE', 'Bilan Hydrique', 'numeric', 'calculated', FALSE, FALSE, 1020)
ON CONFLICT (code) DO UPDATE 
SET 
    source = EXCLUDED.source,
    is_hydric_input = EXCLUDED.is_hydric_input,
    is_hydric_output = EXCLUDED.is_hydric_output;
