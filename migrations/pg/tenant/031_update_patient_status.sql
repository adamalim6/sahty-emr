-- Migration: Update Patient Status Check Constraint
-- ID: 031
-- Description: Updates the check constraint on patients_tenant.status to include 'PROVISIONAL', 'VERIFIED', and 'UNKNOWN'.
-- NOTE: This uses DO block to dynamically find and drop the constraint by checking pg_constraint.

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    -- Find the actual check constraint name on the status column
    SELECT con.conname INTO v_constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'patients_tenant' 
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%'
    LIMIT 1;
    
    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE patients_tenant DROP CONSTRAINT %I', v_constraint_name);
        RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
    END IF;
END $$;

ALTER TABLE patients_tenant 
ADD CONSTRAINT patients_tenant_status_check 
CHECK (status IN ('ACTIVE', 'MERGED', 'INACTIVE', 'PROVISIONAL', 'VERIFIED', 'UNKNOWN'));
