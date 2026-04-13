-- 122_ecg_echo_status_and_obs_entered_in_error.sql
-- 1. Add status state machine to patient_ecg_records and patient_echo_records
-- 2. Add entered_in_error to patient_observations

BEGIN;

-- ============================================================
-- 1. ECG status state machine
-- ============================================================
ALTER TABLE public.patient_ecg_records
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'VALIDATED', 'ENTERED_IN_ERROR')),
    ADD COLUMN IF NOT EXISTS entered_in_error_by   UUID NULL,
    ADD COLUMN IF NOT EXISTS entered_in_error_at   TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS entered_in_error_reason TEXT NULL;

-- ============================================================
-- 2. Echo status state machine
-- ============================================================
ALTER TABLE public.patient_echo_records
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'VALIDATED', 'ENTERED_IN_ERROR')),
    ADD COLUMN IF NOT EXISTS entered_in_error_by   UUID NULL,
    ADD COLUMN IF NOT EXISTS entered_in_error_at   TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS entered_in_error_reason TEXT NULL;

-- ============================================================
-- 3. Add entered_in_error to patient_observations
-- ============================================================
-- First extend the status CHECK to allow ENTERED_IN_ERROR
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.patient_observations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.patient_observations DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE public.patient_observations
    ADD CONSTRAINT patient_observations_status_check
    CHECK (status IN ('DRAFT', 'SIGNED', 'ENTERED_IN_ERROR'));

ALTER TABLE public.patient_observations
    ADD COLUMN IF NOT EXISTS entered_in_error_by     UUID NULL,
    ADD COLUMN IF NOT EXISTS entered_in_error_at     TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS entered_in_error_reason TEXT NULL;

COMMIT;
