-- 075_add_allergy_names.sql

BEGIN;

ALTER TABLE patient_allergies
ADD COLUMN created_by_first_name TEXT,
ADD COLUMN created_by_last_name TEXT;

ALTER TABLE patient_allergy_history
ADD COLUMN created_by_first_name TEXT,
ADD COLUMN created_by_last_name TEXT;

COMMIT;
