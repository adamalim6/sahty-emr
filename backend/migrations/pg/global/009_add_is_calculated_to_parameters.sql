ALTER TABLE observation_parameters ADD COLUMN IF NOT EXISTS is_calculated BOOLEAN NOT NULL DEFAULT false;
