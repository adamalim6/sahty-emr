-- Migration 021: Return Decisions Schema Fix
-- Addresses:
-- 1. Add destination_location_id to return_decision_lines
-- 2. Add SYSTEM scope to locations
-- 3. Update outcome values to match implementation
-- 4. Create WASTE virtual location

-- Step 1: Add SYSTEM scope to locations table
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_scope_check;
ALTER TABLE locations ADD CONSTRAINT locations_scope_check CHECK (scope IN ('PHARMACY', 'SERVICE', 'SYSTEM'));

-- Step 2: Add destination_location_id to return_decision_lines
ALTER TABLE return_decision_lines 
ADD COLUMN IF NOT EXISTS destination_location_id UUID REFERENCES locations(location_id);

-- Step 3: Update outcome constraint (if 020 wasn't applied or needs fix)
ALTER TABLE return_decision_lines DROP CONSTRAINT IF EXISTS return_decision_lines_outcome_check;
ALTER TABLE return_decision_lines ADD CONSTRAINT return_decision_lines_outcome_check 
CHECK (outcome IN ('COMMERCIAL', 'CHARITY', 'WASTE'));

-- Step 4: Create WASTE virtual location (idempotent - check if exists first)
INSERT INTO locations (tenant_id, name, type, scope, location_class, valuation_policy, status)
SELECT 
    (SELECT tenant_id FROM locations LIMIT 1),  -- Get tenant_id from existing location
    'WASTE',
    'VIRTUAL',
    'SYSTEM',
    'COMMERCIAL',
    'NON_VALUABLE',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM locations WHERE name = 'WASTE' AND scope = 'SYSTEM'
);

-- Also ensure RETURN_QUARANTINE exists
INSERT INTO locations (tenant_id, name, type, scope, location_class, valuation_policy, status)
SELECT 
    (SELECT tenant_id FROM locations LIMIT 1),
    'RETURN_QUARANTINE',
    'VIRTUAL',
    'SYSTEM',
    'COMMERCIAL',
    'VALUABLE',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM locations WHERE name = 'RETURN_QUARANTINE'
);
