-- 1. Drop the legacy taxonomy text columns from the main catalog table
ALTER TABLE public.global_actes 
DROP COLUMN IF EXISTS famille_sih,
DROP COLUMN IF EXISTS sous_famille_sih;
