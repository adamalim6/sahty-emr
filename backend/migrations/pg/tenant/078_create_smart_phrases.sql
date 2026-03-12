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
-- Seed base smart phrases
INSERT INTO smart_phrases (id, trigger, trigger_search, label, description, body_html, scope, tenant_id)
VALUES 
    (gen_random_uuid(), 'progress', 'progress', 'Note d''évolution', 'Évaluation quotidienne standard', '<p><strong>Plaintes récentes:</strong></p><p>{{cursor}}</p><p><strong>Examen clinique:</strong></p><p></p><p><strong>Plan:</strong></p><p></p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'procedure', 'procedure', 'Compte-rendu opératoire', 'Note pour une procédure', '<p><strong>Opérateur:</strong></p><p>{{cursor}}</p><p><strong>Description:</strong></p><p></p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'problem', 'problem', 'Nouveau problème', 'Déclaration d''un nouveau problème', '<p><strong>Problème:</strong></p><p>{{cursor}}</p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'progressicu', 'progressicu', 'Évolution Soins Intensifs', 'Note détaillée pour SI', '<p><strong>Statut neurologique:</strong></p><p>{{cursor}}</p><p><strong>Hémodynamique:</strong></p><p></p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'progresscardio', 'progresscardio', 'Évolution Cardiologie', 'Note orientée cardio', '<p><strong>Examen cardio:</strong></p><p>{{cursor}}</p><p><strong>ECG:</strong></p><p></p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'hpi', 'hpi', 'Histoire de la maladie', 'Historique détaillé', '<p>Le patient se présente pour </p><p>{{cursor}}</p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'exam', 'exam', 'Examen général', 'Examen physique standard', '<p><strong>Signes vitaux:</strong> Stables</p><p><strong>Général:</strong></p><p>{{cursor}}</p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'eval', 'eval', 'Évaluation initiale', 'Première évaluation', '<p><strong>Motif:</strong></p><p>{{cursor}}</p>', 'tenant', '__TENANT_ID__'::uuid),
    (gen_random_uuid(), 'echo', 'echo', 'Résultat d''échographie', 'Compte-rendu écho', '<p><strong>Indication:</strong></p><p>{{cursor}}</p><p><strong>Conclusion:</strong></p><p></p>', 'tenant', '__TENANT_ID__'::uuid)
ON CONFLICT DO NOTHING;

COMMIT;
