-- Migration 055: Add denormalized prescriber name columns
-- Adds created_by_first_name and created_by_last_name to prescriptions table
-- Idempotent: safe to re-run

ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS created_by_first_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_last_name  TEXT;
