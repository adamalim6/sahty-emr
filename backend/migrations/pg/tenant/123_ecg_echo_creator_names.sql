-- 123_ecg_echo_creator_names.sql
-- Denormalize creator name onto ECG/Echo records to avoid join at read time

BEGIN;

ALTER TABLE public.patient_ecg_records
    ADD COLUMN IF NOT EXISTS created_by_first_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS created_by_last_name  TEXT NULL;

ALTER TABLE public.patient_echo_records
    ADD COLUMN IF NOT EXISTS created_by_first_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS created_by_last_name  TEXT NULL;

COMMIT;
