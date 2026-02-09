
-- Drop the legacy global_patient_id column
ALTER TABLE public.patients_tenant
DROP COLUMN IF EXISTS global_patient_id;
