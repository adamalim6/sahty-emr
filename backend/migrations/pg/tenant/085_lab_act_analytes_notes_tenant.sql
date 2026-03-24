DO $$ 
BEGIN
    -- Drop result_role column if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'reference' 
        AND table_name = 'lab_act_analytes' 
        AND column_name = 'result_role'
    ) THEN
        ALTER TABLE reference.lab_act_analytes DROP COLUMN result_role;
    END IF;

    -- Add the notes column if it does not exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'reference' 
        AND table_name = 'lab_act_analytes' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE reference.lab_act_analytes ADD COLUMN notes TEXT NULL;
    END IF;
END $$;
