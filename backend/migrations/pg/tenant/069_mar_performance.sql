-- Migration 069: MAR Performance and Hydric Balance Framework
-- Executes against all tenant databases

-- ==============================================================================
-- 1. Clinical Data Storage (Administration & Prescriptions)
-- ==============================================================================

-- Administration Events (Epic Model)
ALTER TABLE administration_events 
ADD COLUMN IF NOT EXISTS volume_administered_ml NUMERIC(10,2) NULL,
ADD COLUMN IF NOT EXISTS tenant_patient_id UUID NULL;

-- Prescriptions
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE;

-- Prescription Events (MAR Rendering)
ALTER TABLE prescription_events 
ADD COLUMN IF NOT EXISTS requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_end_event BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tenant_patient_id UUID NULL;

-- Ensure Blood Bags has the correct column
ALTER TABLE administration_event_blood_bags
ADD COLUMN IF NOT EXISTS volume_administered_ml NUMERIC(10,2) NULL;

-- ==============================================================================
-- 2. Reference Schema Updates (Local Cache)
-- ==============================================================================

-- Routes
ALTER TABLE reference.routes 
ADD COLUMN IF NOT EXISTS requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE;

-- Units
ALTER TABLE reference.units 
ADD COLUMN IF NOT EXISTS requires_fluid_info BOOLEAN NOT NULL DEFAULT FALSE;

-- Observation Parameters
ALTER TABLE reference.observation_parameters 
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'reference.observation_parameters'::regclass 
        AND conname = 'chk_observation_source'
    ) THEN
        ALTER TABLE reference.observation_parameters
        ADD CONSTRAINT chk_observation_source
        CHECK (source IN ('manual','calculated'));
    END IF;
END $$;

-- Populate local hydric parameters to match global
INSERT INTO reference.observation_parameters (id, code, label, value_type, source, is_hydric_input, is_hydric_output, sort_order)
VALUES 
    (gen_random_uuid(), 'HYDRIC_INPUT', 'Apports (Hydrique)', 'numeric', 'calculated', TRUE, FALSE, 1000),
    (gen_random_uuid(), 'HYDRIC_OUTPUT', 'Pertes (Hydrique)', 'numeric', 'calculated', FALSE, TRUE, 1010),
    (gen_random_uuid(), 'HYDRIC_BALANCE', 'Bilan Hydrique', 'numeric', 'calculated', FALSE, FALSE, 1020)
ON CONFLICT (code) DO UPDATE 
SET 
    source = EXCLUDED.source,
    is_hydric_input = EXCLUDED.is_hydric_input,
    is_hydric_output = EXCLUDED.is_hydric_output;

-- ==============================================================================
-- 3. Data Cleanup & Fast Migration
-- ==============================================================================

-- Safely clear all prototyping clinical data to allow for clean constraints & backfills.
-- Done per user instruction as existing data is "prototyping data".
TRUNCATE TABLE 
    prescriptions, 
    prescription_events, 
    administration_events, 
    administration_event_blood_bags, 
    transfusion_blood_bags, 
    transfusion_checks, 
    transfusion_reactions 
CASCADE;

-- ==============================================================================
-- 4. High-Performance Indexing
-- ==============================================================================

-- MAR Start Dots
CREATE INDEX IF NOT EXISTS idx_admin_events_patient_start 
ON administration_events (tenant_patient_id, actual_start_at) 
WHERE actual_start_at IS NOT NULL;

-- MAR Stop Dots
CREATE INDEX IF NOT EXISTS idx_admin_events_patient_end 
ON administration_events (tenant_patient_id, actual_end_at) 
WHERE actual_end_at IS NOT NULL;

-- Hydric Calculation Engine
CREATE INDEX IF NOT EXISTS idx_admin_events_fluid 
ON administration_events (tenant_patient_id, actual_end_at) 
WHERE volume_administered_ml IS NOT NULL;

-- Scheduled Events (Fast MAR Fetch)
CREATE INDEX IF NOT EXISTS idx_prescription_events_patient_time 
ON prescription_events (tenant_patient_id, scheduled_at);

-- Surveillance Temporal Ordering (Fast Rebuilds & Analytics)
CREATE INDEX IF NOT EXISTS idx_surveillance_events_patient_time_param 
ON surveillance_values_events (tenant_patient_id, recorded_at, parameter_code);
