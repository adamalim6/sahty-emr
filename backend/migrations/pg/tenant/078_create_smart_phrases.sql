-- 078_create_smart_phrases.sql

BEGIN;

CREATE TABLE IF NOT EXISTS smart_phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trigger TEXT NOT NULL,
    trigger_search TEXT NOT NULL,

    label TEXT,
    description TEXT,

    body_html TEXT NOT NULL,

    scope TEXT NOT NULL CHECK (scope IN ('tenant', 'user')),

    tenant_id UUID NULL,
    user_id UUID NULL REFERENCES auth.users(user_id),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID NULL REFERENCES auth.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_smart_phrases_scope_refs CHECK (
        (scope = 'tenant' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
        (scope = 'user' AND tenant_id IS NOT NULL AND user_id IS NOT NULL)
    ),

    UNIQUE(trigger, scope, tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_smart_phrases_trigger ON smart_phrases(trigger);
CREATE INDEX IF NOT EXISTS idx_smart_phrases_scope ON smart_phrases(scope, tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_smart_phrases_trigger_search ON smart_phrases(trigger_search);
CREATE INDEX IF NOT EXISTS idx_smart_phrases_active_search ON smart_phrases(trigger_search) WHERE is_active = TRUE;
-- Seed base smart phrases has been removed. Seed is now copied from global via tenantProvisioningService.

COMMIT;
