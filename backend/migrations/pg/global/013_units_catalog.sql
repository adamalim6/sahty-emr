-- Global Reference Units Catalog Migration

CREATE TABLE IF NOT EXISTS units (
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
ALTER TABLE observation_parameters ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;

INSERT INTO units (code, display, is_ucum, sort_order) VALUES
    ('mg', 'mg', true, 10),
    ('g', 'g', true, 20),
    ('µg', 'µg', true, 30),
    ('mcg', 'mcg', true, 35),
    ('mL', 'mL', true, 40),
    ('L', 'L', true, 50),
    ('mL/h', 'mL/h', true, 60),
    ('mmHg', 'mmHg', true, 70),
    ('bpm', 'bpm', true, 80),
    ('°C', '°C', true, 90),
    ('UI', 'UI', true, 100),
    ('UI/h', 'UI/h', true, 110),
    ('UI/kg/h', 'UI/kg/h', true, 120),
    ('mg/kg/h', 'mg/kg/h', true, 130),
    ('µg/kg/min', 'µg/kg/min', true, 140),
    ('ampoule', 'ampoule(s)', false, 200),
    ('flacon', 'flacon(s)', false, 210),
    ('dose', 'dose(s)', false, 220),
    ('poche', 'poche(s)', false, 230),
    ('spray', 'spray', false, 240),
    ('sachet', 'sachet(s)', false, 250),
    ('comprimé', 'comprimé(s)', false, 260),
    ('gélule', 'gélule(s)', false, 270),
    ('unité', 'unité(s)', false, 280),
    ('rpm', 'rpm', true, 290)
ON CONFLICT (code) DO UPDATE SET display = EXCLUDED.display;

