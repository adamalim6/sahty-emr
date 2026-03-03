-- Migration 023: Add lifecycle columns to patient_diagnoses

ALTER TABLE public.patient_diagnoses
ADD COLUMN IF NOT EXISTS resolved_by_user_id uuid,
ADD COLUMN IF NOT EXISTS resolution_note text,
ADD COLUMN IF NOT EXISTS voided_by_user_id uuid;

-- These columns do not have foreign key constraints to global users table directly here
-- to prevent cross-db joining complexity inside tenant schemas, but they hold 
-- valid global user UUIDs.
