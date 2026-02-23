-- Create dci_synonyms table in global schema
CREATE TABLE IF NOT EXISTS public.dci_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dci_id UUID NOT NULL REFERENCES public.global_dci(id) ON DELETE CASCADE,
    synonym TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dci_synonyms_dci_id ON public.dci_synonyms(dci_id);

-- Drop synonyms JSONB column from global_dci
ALTER TABLE public.global_dci DROP COLUMN IF EXISTS synonyms;
