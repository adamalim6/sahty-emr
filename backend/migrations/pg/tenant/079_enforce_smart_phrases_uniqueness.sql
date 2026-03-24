-- 079_enforce_smart_phrases_uniqueness.sql

BEGIN;

-- 1. Identify and safely rename any existing duplicates
-- A trigger is considered duplicate if the same tenant_id has multiple rows with the same LOWER(trigger).
-- We will append '_duplicate_' and the short id to ensure they don't collide.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT id, trigger
        FROM smart_phrases sp
        WHERE EXISTS (
            SELECT 1 
            FROM smart_phrases sp2 
            WHERE LOWER(sp2.trigger) = LOWER(sp.trigger) 
              AND ((sp2.tenant_id = sp.tenant_id) OR (sp2.tenant_id IS NULL AND sp.tenant_id IS NULL))
              AND sp2.id < sp.id
        )
    )
    LOOP
        RAISE NOTICE 'Renaming duplicate trigger % for id %', r.trigger, r.id;
        UPDATE smart_phrases
        SET trigger = trigger || '_duplicate_' || substr(id::text, 1, 8),
            trigger_search = trigger_search || 'duplicate' || substr(id::text, 1, 8)
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- 2. Drop the old composite unique constraint
ALTER TABLE smart_phrases DROP CONSTRAINT IF EXISTS smart_phrases_trigger_scope_tenant_id_user_id_key;

-- 3. In PostgreSQL, unique indexes with NULLs don't conflict, but for safety in our specific case
-- tenant_id is either NULL (in global, but this is tenant DB) or specified.
-- To explicitly handle NULL tenant_id (if any system phrases were hardcoded with NULL before this change):
CREATE UNIQUE INDEX IF NOT EXISTS smart_phrases_trigger_unique_ci 
ON smart_phrases (tenant_id, LOWER(trigger));

-- 4. Update the CHECK constraint to allow 'system' scope
ALTER TABLE smart_phrases DROP CONSTRAINT IF EXISTS chk_smart_phrases_scope_refs;

-- We still ensure that user_id is NOT NULL if scope is 'user', 
-- and user_id IS NULL if scope is 'tenant' or 'system'
-- and tenant_id IS NULL if scope is 'system' OR tenant_id IS NOT NULL if scope is 'system' inside tenant DB (Provisioning sets tenant_id locally)
ALTER TABLE smart_phrases ADD CONSTRAINT chk_smart_phrases_scope_refs CHECK (
    (scope = 'system' AND user_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
    (scope = 'user' AND tenant_id IS NOT NULL AND user_id IS NOT NULL)
);

-- We also make sure the `scope` check constraint itself allows 'system'
ALTER TABLE smart_phrases DROP CONSTRAINT IF EXISTS smart_phrases_scope_check;
ALTER TABLE smart_phrases ADD CONSTRAINT smart_phrases_scope_check CHECK (scope IN ('system', 'tenant', 'user'));

COMMIT;
