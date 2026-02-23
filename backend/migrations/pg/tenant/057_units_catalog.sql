-- Tenant Units Catalog Migration (Mirrored from global)

CREATE TABLE IF NOT EXISTS reference.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    display TEXT NOT NULL,
    is_ucum BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- We add unit_id but keep unit string for backwards compatibility
ALTER TABLE reference.observation_parameters ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES reference.units(id) ON DELETE SET NULL;
