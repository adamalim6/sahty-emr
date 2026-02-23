CREATE TABLE IF NOT EXISTS observation_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    unit TEXT,
    value_type TEXT NOT NULL,
    normal_min NUMERIC,
    normal_max NUMERIC,
    warning_min NUMERIC,
    warning_max NUMERIC,
    hard_min NUMERIC,
    hard_max NUMERIC,
    is_hydric_input BOOLEAN DEFAULT false,
    is_hydric_output BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observation_flowsheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapping Tables
CREATE TABLE IF NOT EXISTS flowsheet_groups (
    flowsheet_id UUID NOT NULL REFERENCES observation_flowsheets(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES observation_groups(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (flowsheet_id, group_id)
);

CREATE TABLE IF NOT EXISTS group_parameters (
    group_id UUID NOT NULL REFERENCES observation_groups(id) ON DELETE CASCADE,
    parameter_id UUID NOT NULL REFERENCES observation_parameters(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (group_id, parameter_id)
);
