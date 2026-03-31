-- Migration: Replace implicit specimen types with explicit container combinations for acts

BEGIN;

-- 1. Create the new explicit M2M mapping table
CREATE TABLE IF NOT EXISTS reference.lab_act_specimen_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_act_id UUID NOT NULL,
    specimen_type_id UUID NOT NULL,
    container_type_id UUID NOT NULL,
    
    is_required BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    min_volume NUMERIC,
    volume_unit_id UUID,
    volume_unit_label TEXT,
    
    collection_instructions TEXT,
    
    sort_order INTEGER NOT NULL DEFAULT 0,
    actif BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure the act references a valid global act
    CONSTRAINT fk_lab_act_spec_cont_act 
        FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id) ON DELETE CASCADE,
        
    -- Ensure the specimen maps to a valid specimen type
    CONSTRAINT fk_lab_act_spec_cont_specimen 
        FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id) ON DELETE CASCADE,
        
    -- Ensure the container maps to a valid container type
    CONSTRAINT fk_lab_act_spec_cont_container 
        FOREIGN KEY (container_type_id) REFERENCES reference.lab_container_types(id) ON DELETE CASCADE,
        
    -- Foreign key to volume unit
    CONSTRAINT fk_lab_act_spec_cont_unit 
        FOREIGN KEY (volume_unit_id) REFERENCES reference.units(id) ON DELETE SET NULL,
        
    -- Ensure no duplicate identical combination per act
    CONSTRAINT lab_act_spec_cont_unique UNIQUE (global_act_id, specimen_type_id, container_type_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_lab_act_spec_cont_global_act_id ON reference.lab_act_specimen_containers(global_act_id);
CREATE INDEX IF NOT EXISTS idx_ref_lab_act_spec_cont_specimen_type_id ON reference.lab_act_specimen_containers(specimen_type_id);
CREATE INDEX IF NOT EXISTS idx_ref_lab_act_spec_cont_container_type_id ON reference.lab_act_specimen_containers(container_type_id);

-- 2. Data Migration
-- We copy all existing specimen assignments and dynamically discover the previously assumed default container
INSERT INTO reference.lab_act_specimen_containers (
    id,
    global_act_id,
    specimen_type_id,
    container_type_id,
    is_required,
    is_default,
    sort_order,
    actif,
    created_at,
    updated_at,
    min_volume,
    volume_unit_id,
    volume_unit_label
)
SELECT 
    old.id, -- We can preserve the UUIDs to limit churn
    old.global_act_id,
    old.specimen_type_id,
    sct.container_type_id,
    old.is_required,
    old.is_default,
    old.sort_order,
    old.actif,
    old.created_at,
    old.updated_at,
    old.min_volume,
    old.volume_unit_id,
    old.volume_unit_label
FROM reference.lab_act_specimen_types old
-- Force join ONLY the default container as per legacy assumptions
JOIN reference.lab_specimen_container_types sct 
    ON old.specimen_type_id = sct.specimen_type_id 
    AND sct.is_default = true 
    AND sct.actif = true
ON CONFLICT DO NOTHING;

-- 3. Cleanup: Drop the old table entirely
DROP TABLE reference.lab_act_specimen_types CASCADE;

COMMIT;
