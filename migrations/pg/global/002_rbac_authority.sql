-- RBAC Authority Migration
-- Adds the 'assignable_by' column to global_roles to control role assignment authority.

-- 1. Add the column with a default value
ALTER TABLE global_roles
ADD COLUMN IF NOT EXISTS assignable_by TEXT DEFAULT 'TENANT_ADMIN';

-- 2. Classify existing roles based on RBAC rules
UPDATE global_roles SET assignable_by = 'NONE' WHERE code = 'SUPER_ADMIN';
UPDATE global_roles SET assignable_by = 'SUPER_ADMIN' WHERE code = 'ADMIN_STRUCTURE';
UPDATE global_roles SET assignable_by = 'TENANT_ADMIN' WHERE code NOT IN ('SUPER_ADMIN', 'ADMIN_STRUCTURE');

-- 3. Enforce NOT NULL and CHECK constraint
ALTER TABLE global_roles
ALTER COLUMN assignable_by SET NOT NULL;

-- Note: ALTER TABLE ADD CONSTRAINT IF NOT EXISTS is not supported in all PG versions.
-- This constraint will be added only if it doesn't exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'global_roles_assignable_by_check'
    ) THEN
        ALTER TABLE global_roles
        ADD CONSTRAINT global_roles_assignable_by_check
        CHECK (assignable_by IN ('NONE', 'SUPER_ADMIN', 'TENANT_ADMIN'));
    END IF;
END $$;
