-- Plateaux Techniques: types of technical units (OR, consultation box, imaging room, etc.)
CREATE TABLE IF NOT EXISTS technical_unit_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT,
    description TEXT,
    icon        TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_technical_unit_types_name
    ON technical_unit_types (lower(name)) WHERE is_active = true;
