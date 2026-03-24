BEGIN;

CREATE TABLE IF NOT EXISTS public.smart_phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    trigger TEXT NOT NULL,
    trigger_search TEXT NOT NULL,
    label TEXT,
    description TEXT,
    body_html TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('SYSTEM', 'TENANT', 'USER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_phrases_trigger ON public.smart_phrases(trigger_search);
CREATE INDEX IF NOT EXISTS idx_smart_phrases_scope ON public.smart_phrases(scope, tenant_id, user_id);

COMMIT;
