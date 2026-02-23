-- Create dci_synonyms table in tenant reference schema
CREATE TABLE IF NOT EXISTS reference.dci_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dci_id UUID NOT NULL REFERENCES reference.global_dci(id) ON DELETE CASCADE,
    synonym TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_dci_synonyms_dci_id ON reference.dci_synonyms(dci_id);

-- Drop synonyms JSONB column from reference.global_dci
ALTER TABLE reference.global_dci DROP COLUMN IF EXISTS synonyms;
